import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


os.environ["JWT_SECRET_KEY"] = "test-secret"

from app import models
from app.database import Base, get_db
from app.main import create_app
from app.routers import auth


class InterviewsApiTest(unittest.TestCase):
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
            company = models.Company(
                company_name="株式会社テスト",
                motivation="志望動機",
                resume="経歴",
            )
            database.add(company)
            database.commit()
            database.refresh(company)
            self.company_id = company.id

    def tearDown(self):
        self.client.close()
        self.app.dependency_overrides.clear()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def chat_payload(self, **overrides):
        return {
            "company_id": self.company_id,
            "question_strength": "standard",
            "history": [],
            **overrides,
        }

    def test_each_preset_uses_existing_guide_and_keeps_fixed_constraints(self):
        guides = {
            "easy": "優しい口調で、基本的な質問を中心にしてください",
            "standard": "一般的な面接と同じ調子で質問してください",
            "hard": "回答の曖昧な点や矛盾を深掘りし、鋭く追及してください",
        }

        for question_strength, guide in guides.items():
            with self.subTest(question_strength=question_strength), patch(
                "app.routers.interviews.llm.generate_reply", return_value="質問です"
            ) as generate_reply:
                response = self.client.post(
                    "/interviews/chat",
                    json=self.chat_payload(question_strength=question_strength),
                )

                self.assertEqual(response.status_code, 200, response.text)
                system_prompt = generate_reply.call_args.args[0]
                self.assertIn(
                    f"# 質問の強度: {question_strength}。{guide}", system_prompt
                )
                self.assertIn("次の質問を1つだけ", system_prompt)
                self.assertIn("質問文のみを返し", system_prompt)

    def test_custom_uses_trimmed_instruction_and_keeps_fixed_constraints(self):
        instruction = "回答の根拠を数値で確認し、曖昧な点を深掘りしてください"
        with patch(
            "app.routers.interviews.llm.generate_reply", return_value="質問です"
        ) as generate_reply:
            response = self.client.post(
                "/interviews/chat",
                json=self.chat_payload(
                    question_strength="custom",
                    custom_question_strength=f"  {instruction}\n",
                ),
            )

        self.assertEqual(response.status_code, 200, response.text)
        system_prompt = generate_reply.call_args.args[0]
        self.assertIn(f"# 質問の強度: custom。{instruction}", system_prompt)
        self.assertNotIn(f"  {instruction}", system_prompt)
        self.assertIn("次の質問を1つだけ", system_prompt)
        self.assertIn("質問文のみを返し", system_prompt)

    def test_rejects_missing_legacy_invalid_and_unknown_strength_fields(self):
        invalid_payloads = [
            {"company_id": self.company_id, "history": []},
            self.chat_payload(intensity="標準"),
            self.chat_payload(question_strength="normal"),
            self.chat_payload(unknown_field="value"),
        ]

        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                response = self.client.post("/interviews/chat", json=payload)
                self.assertEqual(response.status_code, 422, response.text)

    def test_custom_instruction_is_required_only_for_custom(self):
        invalid_payloads = [
            self.chat_payload(question_strength="custom"),
            self.chat_payload(
                question_strength="custom", custom_question_strength=None
            ),
            self.chat_payload(
                question_strength="custom", custom_question_strength=" \n\t "
            ),
            self.chat_payload(
                question_strength="custom", custom_question_strength="指" * 501
            ),
            self.chat_payload(custom_question_strength="追加指示"),
            self.chat_payload(custom_question_strength=None),
        ]

        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                response = self.client.post("/interviews/chat", json=payload)
                self.assertEqual(response.status_code, 422, response.text)

    def test_custom_instruction_accepts_500_trimmed_characters(self):
        instruction = "指" * 500
        with patch(
            "app.routers.interviews.llm.generate_reply", return_value="質問です"
        ) as generate_reply:
            response = self.client.post(
                "/interviews/chat",
                json=self.chat_payload(
                    question_strength="custom",
                    custom_question_strength=f"  {instruction}  ",
                ),
            )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertIn(instruction, generate_reply.call_args.args[0])


if __name__ == "__main__":
    unittest.main()
