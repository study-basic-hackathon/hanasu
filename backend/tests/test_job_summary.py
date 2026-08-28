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

# app.security validates this environment variable while app.main is imported.
os.environ["JWT_SECRET_KEY"] = "test-secret"

from app import models
from app.database import Base, get_db
from app.main import create_app
from app.routers import auth


MIGRATION_PATH = (
    Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "ac90a1a923cd_add_job_summary_to_companies.py"
)


class JobSummaryMigrationTest(unittest.TestCase):
    def test_upgrade_adds_nullable_text_column_and_preserves_existing_company(self):
        engine = create_engine("sqlite+pysqlite:///:memory:")

        try:
            with engine.begin() as connection:
                connection.execute(
                    text(
                        """
                        CREATE TABLE companies (
                            id INTEGER PRIMARY KEY,
                            company_name VARCHAR NOT NULL,
                            motivation TEXT,
                            resume TEXT,
                            company_url VARCHAR,
                            note TEXT,
                            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                        )
                        """
                    )
                )
                connection.execute(
                    text(
                        """
                        INSERT INTO companies (
                            id, company_name, motivation, resume, company_url, note
                        ) VALUES (
                            1, '既存企業', '既存の志望動機', '既存の経歴',
                            'https://example.com/jobs/1', '既存の備考'
                        )
                        """
                    )
                )

                spec = importlib.util.spec_from_file_location(
                    "job_summary_migration", MIGRATION_PATH
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
                    for column in inspect(connection).get_columns("companies")
                }
                existing = connection.execute(
                    text(
                        """
                        SELECT id, company_name, motivation, resume,
                               company_url, note, job_summary
                        FROM companies
                        WHERE id = 1
                        """
                    )
                ).mappings().one()

            self.assertIn("job_summary", columns)
            self.assertEqual(columns["job_summary"]["type"].__class__.__name__, "TEXT")
            self.assertTrue(columns["job_summary"]["nullable"])
            self.assertEqual(existing["company_name"], "既存企業")
            self.assertEqual(existing["motivation"], "既存の志望動機")
            self.assertEqual(existing["resume"], "既存の経歴")
            self.assertEqual(existing["company_url"], "https://example.com/jobs/1")
            self.assertEqual(existing["note"], "既存の備考")
            self.assertIsNone(existing["job_summary"])
        finally:
            engine.dispose()


class JobSummaryApiTest(unittest.TestCase):
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

    def tearDown(self):
        self.client.close()
        self.app.dependency_overrides.clear()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def create_company(self, company_name: str, **overrides):
        payload = {
            "company_name": company_name,
            "motivation": "志望動機",
            **overrides,
        }
        response = self.client.post("/companies", json=payload)
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def test_create_read_and_list_return_saved_job_summary(self):
        created = self.create_company(
            "作成・取得テスト企業", job_summary="バックエンド開発の募集です。"
        )

        read_response = self.client.get(f"/companies/{created['id']}")
        list_response = self.client.get("/companies")

        self.assertEqual(
            created["job_summary"], "バックエンド開発の募集です。"
        )
        self.assertEqual(read_response.status_code, 200, read_response.text)
        self.assertEqual(
            read_response.json()["job_summary"], "バックエンド開発の募集です。"
        )
        self.assertEqual(list_response.status_code, 200, list_response.text)
        listed = next(
            company
            for company in list_response.json()
            if company["id"] == created["id"]
        )
        self.assertEqual(listed["job_summary"], "バックエンド開発の募集です。")

    def test_update_saves_and_returns_job_summary(self):
        created = self.create_company(
            "更新テスト企業", job_summary="更新前の募集要項"
        )

        response = self.client.put(
            f"/companies/{created['id']}",
            json={
                "company_name": "更新テスト企業",
                "motivation": "更新後の志望動機",
                "job_summary": "更新後の募集要項",
            },
        )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["job_summary"], "更新後の募集要項")
        self.assertEqual(
            self.client.get(f"/companies/{created['id']}").json()["job_summary"],
            "更新後の募集要項",
        )

    def test_create_accepts_omitted_and_explicit_null_job_summary(self):
        omitted = self.create_company("要約省略テスト企業")
        explicit_null = self.create_company("要約nullテスト企業", job_summary=None)

        self.assertIsNone(omitted["job_summary"])
        self.assertIsNone(explicit_null["job_summary"])

    def test_update_accepts_null_job_summary(self):
        created = self.create_company(
            "要約null更新テスト企業", job_summary="削除前の募集要項"
        )

        response = self.client.put(
            f"/companies/{created['id']}",
            json={
                "company_name": "要約null更新テスト企業",
                "motivation": "志望動機",
                "job_summary": None,
            },
        )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertIsNone(response.json()["job_summary"])
        self.assertIsNone(
            self.client.get(f"/companies/{created['id']}").json()["job_summary"]
        )

    def test_chat_system_prompt_includes_saved_job_summary(self):
        created = self.create_company(
            "プロンプト要約あり企業", job_summary="SaaSの運用改善を担う募集です。"
        )

        with patch(
            "app.routers.interviews.llm.generate_reply", return_value="質問です"
        ) as generate_reply:
            response = self.client.post(
                "/interviews/chat",
                json={
                    "company_id": created["id"],
                    "intensity": "標準",
                    "history": [],
                },
            )

        self.assertEqual(response.status_code, 200, response.text)
        system_prompt = generate_reply.call_args.args[0]
        self.assertIn(
            "# 募集要項の要約: SaaSの運用改善を担う募集です。", system_prompt
        )

    def test_chat_system_prompt_omits_job_summary_when_unregistered(self):
        created = self.create_company("プロンプト要約なし企業", job_summary=None)

        with patch(
            "app.routers.interviews.llm.generate_reply", return_value="質問です"
        ) as generate_reply:
            response = self.client.post(
                "/interviews/chat",
                json={
                    "company_id": created["id"],
                    "intensity": "標準",
                    "history": [],
                },
            )

        self.assertEqual(response.status_code, 200, response.text)
        system_prompt = generate_reply.call_args.args[0]
        self.assertNotIn("# 募集要項の要約:", system_prompt)
        self.assertIn("# 応募先企業: プロンプト要約なし企業", system_prompt)
        self.assertIn(
            "会話履歴が空の場合は、自己紹介と志望動機を尋ねる最初の質問をしてください。",
            system_prompt,
        )


if __name__ == "__main__":
    unittest.main()
