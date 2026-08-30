import importlib.util
import os
from pathlib import Path
import unittest
from unittest.mock import patch

from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


os.environ["JWT_SECRET_KEY"] = "test-secret"

from app import models
from app.database import Base, get_db
from app.main import create_app
from app.routers import auth
from app.routers.evaluations import _calculate_total_score


MIGRATION_PATH = (
    Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "4b7f8d2c9a10_add_evaluation_question_strength_and_turn_count.py"
)


class EvaluationMetadataMigrationTest(unittest.TestCase):
    def test_upgrade_adds_nullable_columns_and_preserves_existing_evaluation(self):
        engine = create_engine("sqlite+pysqlite:///:memory:")

        try:
            with engine.begin() as connection:
                connection.execute(
                    text(
                        """
                        CREATE TABLE evaluations (
                            evaluation_id INTEGER PRIMARY KEY,
                            company_id INTEGER,
                            company_name VARCHAR,
                            status VARCHAR NOT NULL,
                            total_score INTEGER,
                            scores JSON,
                            advice JSON,
                            error VARCHAR,
                            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                        )
                        """
                    )
                )
                connection.execute(
                    text(
                        """
                        INSERT INTO evaluations (
                            evaluation_id, company_id, company_name, status,
                            total_score, scores, advice, error
                        ) VALUES (
                            1, 12, '既存企業', 'completed', 72,
                            '{"filler": {"score": 72}}', '["既存の助言"]', NULL
                        )
                        """
                    )
                )

                spec = importlib.util.spec_from_file_location(
                    "evaluation_metadata_migration", MIGRATION_PATH
                )
                if spec is None or spec.loader is None:
                    self.fail(f"migrationを読み込めません: {MIGRATION_PATH}")
                migration = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(migration)

                operations = Operations(MigrationContext.configure(connection))
                with patch.object(migration, "op", operations):
                    migration.upgrade()

                columns = {
                    column["name"]: column
                    for column in inspect(connection).get_columns("evaluations")
                }
                existing = connection.execute(
                    text(
                        """
                        SELECT evaluation_id, company_id, company_name, status,
                               total_score, scores, advice, error,
                               question_strength, turn_count
                        FROM evaluations WHERE evaluation_id = 1
                        """
                    )
                ).mappings().one()

            self.assertTrue(columns["question_strength"]["nullable"])
            self.assertTrue(columns["turn_count"]["nullable"])
            self.assertEqual(existing["company_id"], 12)
            self.assertEqual(existing["company_name"], "既存企業")
            self.assertEqual(existing["status"], "completed")
            self.assertEqual(existing["total_score"], 72)
            self.assertEqual(existing["scores"], '{"filler": {"score": 72}}')
            self.assertEqual(existing["advice"], '["既存の助言"]')
            self.assertIsNone(existing["question_strength"])
            self.assertIsNone(existing["turn_count"])
        finally:
            engine.dispose()


class EvaluationsApiTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite+pysqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.session_factory = sessionmaker(
            bind=self.engine, autoflush=False, autocommit=False
        )
        Base.metadata.create_all(self.engine)

        def override_get_db():
            database = self.session_factory()
            try:
                yield database
            finally:
                database.close()

        def override_current_user():
            return models.User(id=1, username="test-user", password_hash="unused")

        self.app = create_app([])
        self.app.dependency_overrides[get_db] = override_get_db
        self.app.dependency_overrides[auth.get_current_user] = override_current_user
        self.client = TestClient(self.app)

        with self.session_factory() as database:
            company = models.Company(company_name="株式会社テスト", motivation="志望動機")
            database.add(company)
            database.commit()
            database.refresh(company)
            self.company_id = company.id

    def tearDown(self):
        self.client.close()
        self.app.dependency_overrides.clear()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def evaluation_payload(self, **overrides):
        return {
            "company_id": self.company_id,
            "question_strength": "hard",
            "turn_count": 2,
            "turns": [
                {"role": "assistant", "content": "最初の質問"},
                {"role": "user", "content": "最初の回答"},
                {"role": "assistant", "content": "次の質問"},
                {"role": "user", "content": "次の回答"},
            ],
            "scores": {"filler": {"score": 80, "value": 2, "unit": "回"}},
            **overrides,
        }

    @patch("app.routers.evaluations._run_evaluation")
    def test_create_saves_question_strength_and_turn_count(self, run_evaluation):
        response = self.client.post("/evaluations", json=self.evaluation_payload())

        self.assertEqual(response.status_code, 202, response.text)
        evaluation_id = response.json()["evaluation_id"]
        with self.session_factory() as database:
            created = database.get(models.Evaluation, evaluation_id)
            self.assertEqual(created.question_strength, "hard")
            self.assertEqual(created.turn_count, 2)
        run_evaluation.assert_called_once()

    @patch("app.routers.evaluations._run_evaluation")
    def test_tutorial_saves_null_strength_and_actual_answer_count(self, run_evaluation):
        response = self.client.post(
            "/evaluations",
            json=self.evaluation_payload(
                company_id=None,
                question_strength=None,
                turn_count=1,
                turns=[
                    {"role": "assistant", "content": "自己紹介をお願いします"},
                    {"role": "user", "content": "回答"},
                ],
            ),
        )

        self.assertEqual(response.status_code, 202, response.text)
        with self.session_factory() as database:
            created = database.get(models.Evaluation, response.json()["evaluation_id"])
            self.assertIsNone(created.company_id)
            self.assertIsNone(created.question_strength)
            self.assertEqual(created.turn_count, 1)
        run_evaluation.assert_called_once()

    def test_rejects_turn_count_that_does_not_match_answers(self):
        response = self.client.post(
            "/evaluations", json=self.evaluation_payload(turn_count=1)
        )

        self.assertEqual(response.status_code, 422, response.text)

    def test_detail_and_list_return_metadata_and_scores_for_all_states(self):
        with self.session_factory() as database:
            completed = models.Evaluation(
                company_id=self.company_id,
                company_name="株式会社テスト",
                question_strength="standard",
                turn_count=3,
                status="completed",
                total_score=75,
                scores={"filler": {"score": 80}},
                advice=["助言"],
            )
            processing = models.Evaluation(
                company_name="処理中企業",
                question_strength="easy",
                turn_count=1,
                status="processing",
            )
            failed = models.Evaluation(
                question_strength=None,
                turn_count=1,
                status="failed",
                error="評価失敗",
            )
            legacy = models.Evaluation(status="completed", scores={"filler": {"score": 50}})
            database.add_all([completed, processing, failed, legacy])
            database.commit()
            for evaluation in (completed, processing, failed, legacy):
                database.refresh(evaluation)

        detail_cases = (
            (completed, {"company_id": self.company_id, "company_name": "株式会社テスト", "question_strength": "standard", "turn_count": 3}),
            (processing, {"company_id": None, "company_name": "処理中企業", "question_strength": "easy", "turn_count": 1}),
            (failed, {"company_id": None, "company_name": None, "question_strength": None, "turn_count": 1, "error": "評価失敗"}),
            (legacy, {"company_id": None, "company_name": None, "question_strength": None, "turn_count": None}),
        )
        for evaluation, expected in detail_cases:
            with self.subTest(status=evaluation.status):
                response = self.client.get(f"/evaluations/{evaluation.evaluation_id}")
                self.assertEqual(response.status_code, 200, response.text)
                self.assertEqual(response.json()["status"], evaluation.status)
                for field, value in expected.items():
                    self.assertEqual(response.json()[field], value)

        list_response = self.client.get("/evaluations")
        self.assertEqual(list_response.status_code, 200, list_response.text)
        listed = {
            item["evaluation_id"]: item for item in list_response.json()["evaluations"]
        }
        self.assertEqual(listed[completed.evaluation_id]["company_name"], "株式会社テスト")
        self.assertEqual(listed[completed.evaluation_id]["question_strength"], "standard")
        self.assertEqual(listed[completed.evaluation_id]["turn_count"], 3)
        self.assertEqual(listed[completed.evaluation_id]["scores"], {"filler": {"score": 80}})
        self.assertIsNone(listed[legacy.evaluation_id]["question_strength"])
        self.assertIsNone(listed[legacy.evaluation_id]["turn_count"])

    def create_evaluation(self, **overrides):
        """テスト用の評価結果を1件作り、その ID を返す。"""
        fields = {
            "company_id": self.company_id,
            "company_name": "株式会社テスト",
            "status": "completed",
            "total_score": 70,
            **overrides,
        }
        with self.session_factory() as database:
            evaluation = models.Evaluation(**fields)
            database.add(evaluation)
            database.commit()
            database.refresh(evaluation)
            return evaluation.evaluation_id

    def test_delete_removes_the_evaluation_and_drops_it_from_the_list(self):
        target = self.create_evaluation()
        other = self.create_evaluation()

        response = self.client.delete(f"/evaluations/{target}")

        self.assertEqual(response.status_code, 204, response.text)
        self.assertEqual(response.content, b"")
        self.assertEqual(self.client.get(f"/evaluations/{target}").status_code, 404)
        listed = [
            item["evaluation_id"]
            for item in self.client.get("/evaluations").json()["evaluations"]
        ]
        self.assertNotIn(target, listed)
        self.assertIn(other, listed)

    def test_delete_returns_404_for_an_unknown_evaluation(self):
        response = self.client.delete("/evaluations/999999")

        self.assertEqual(response.status_code, 404, response.text)

    def test_delete_returns_404_when_deleted_twice(self):
        target = self.create_evaluation()

        self.assertEqual(self.client.delete(f"/evaluations/{target}").status_code, 204)
        self.assertEqual(self.client.delete(f"/evaluations/{target}").status_code, 404)

    def test_delete_accepts_processing_and_failed_evaluations(self):
        processing = self.create_evaluation(status="processing", total_score=None)
        failed = self.create_evaluation(status="failed", total_score=None, error="評価失敗")

        for evaluation_id in (processing, failed):
            with self.subTest(evaluation_id=evaluation_id):
                response = self.client.delete(f"/evaluations/{evaluation_id}")
                self.assertEqual(response.status_code, 204, response.text)


class CalculateTotalScoreTest(unittest.TestCase):
    def test_weighted_average_when_all_three_items_exist(self):
        scores = {
            "speaking_speed": {"score": 90},
            "filler": {"score": 80},
            "structure_content": {"score": 70},
        }

        self.assertEqual(_calculate_total_score(scores), 76)

    def test_normalizes_by_remaining_weight_when_filler_is_missing(self):
        scores = {
            "speaking_speed": {"score": 90},
            "structure_content": {"score": 70},
        }

        # 構成・内容60 : 話す速さ20 → 75% : 25% に正規化して計算する
        self.assertEqual(_calculate_total_score(scores), 75)

    def test_normalizes_by_remaining_weight_when_speaking_speed_is_missing(self):
        scores = {
            "filler": {"score": 80},
            "structure_content": {"score": 70},
        }

        # 構成・内容60 : フィラー20 → 75% : 25% に正規化して計算する
        self.assertEqual(_calculate_total_score(scores), 73)

    def test_normalizes_by_remaining_weight_when_structure_content_is_missing(self):
        scores = {
            "speaking_speed": {"score": 90},
            "filler": {"score": 80},
        }

        # フィラー20 : 話す速さ20 → 50% : 50% に正規化して計算する
        self.assertEqual(_calculate_total_score(scores), 85)

    def test_rounds_half_up_instead_of_bankers_rounding(self):
        scores = {
            "structure_content": {"score": 70},
            "filler": {"score": 64},
        }

        # (70*3 + 64*1) / 4 = 68.5 → Python の round() だと 68（偶数丸め）になるが、
        # 仕様どおり 0.5 は切り上げて 69 になることを確認する
        self.assertEqual(_calculate_total_score(scores), 69)

    def test_excludes_optional_pause_item(self):
        scores = {
            "speaking_speed": {"score": 90},
            "filler": {"score": 80},
            "structure_content": {"score": 70},
            "pause": {"score": 0},
        }

        self.assertEqual(_calculate_total_score(scores), 76)

    def test_returns_none_when_no_basic_item_exists(self):
        self.assertIsNone(_calculate_total_score({}))
        self.assertIsNone(_calculate_total_score({"pause": {"score": 50}}))


if __name__ == "__main__":
    unittest.main()
