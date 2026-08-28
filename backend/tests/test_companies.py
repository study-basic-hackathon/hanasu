import os
import unittest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


os.environ["JWT_SECRET_KEY"] = "test-secret"

from app import models
from app.database import Base, get_db
from app.main import create_app
from app.routers import auth


class CompaniesApiTest(unittest.TestCase):
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

    def post_company(self, **overrides):
        payload = {
            "company_name": "株式会社テスト",
            "motivation": "志望動機",
            **overrides,
        }
        return self.client.post("/companies", json=payload)

    def test_create_read_list_update_and_delete_six_fields(self):
        create_response = self.post_company(
            company_url="https://example.com/jobs/1",
            resume="経歴・実績",
            note="備考",
            job_summary="募集要項の要約",
        )

        self.assertEqual(create_response.status_code, 201, create_response.text)
        created = create_response.json()
        self.assertEqual(
            {
                key: created[key]
                for key in (
                    "company_name",
                    "company_url",
                    "motivation",
                    "resume",
                    "note",
                    "job_summary",
                )
            },
            {
                "company_name": "株式会社テスト",
                "company_url": "https://example.com/jobs/1",
                "motivation": "志望動機",
                "resume": "経歴・実績",
                "note": "備考",
                "job_summary": "募集要項の要約",
            },
        )

        read_response = self.client.get(f"/companies/{created['id']}")
        list_response = self.client.get("/companies")
        self.assertEqual(read_response.status_code, 200, read_response.text)
        self.assertEqual(read_response.json(), created)
        self.assertEqual(list_response.status_code, 200, list_response.text)
        self.assertEqual(list_response.json(), [created])

        update_response = self.client.put(
            f"/companies/{created['id']}",
            json={
                "company_name": "株式会社更新",
                "company_url": "https://example.com/jobs/2",
                "motivation": "更新後の志望動機",
                "resume": "更新後の経歴",
                "note": "更新後の備考",
                "job_summary": "更新後の要約",
            },
        )
        self.assertEqual(update_response.status_code, 200, update_response.text)
        self.assertEqual(update_response.json()["job_summary"], "更新後の要約")

        delete_response = self.client.delete(f"/companies/{created['id']}")
        self.assertEqual(delete_response.status_code, 204, delete_response.text)
        self.assertEqual(
            self.client.get(f"/companies/{created['id']}").status_code, 404
        )
        self.assertEqual(self.client.get("/companies").json(), [])

    def test_required_fields_reject_missing_null_wrong_type_and_blank(self):
        invalid_payloads = [
            {"motivation": "志望動機"},
            {"company_name": None, "motivation": "志望動機"},
            {"company_name": 123, "motivation": "志望動機"},
            {"company_name": "   ", "motivation": "志望動機"},
            {"company_name": "株式会社テスト"},
            {"company_name": "株式会社テスト", "motivation": None},
            {"company_name": "株式会社テスト", "motivation": 123},
            {"company_name": "株式会社テスト", "motivation": "\n\t"},
        ]

        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                response = self.client.post("/companies", json=payload)
                self.assertEqual(response.status_code, 422, response.text)

    def test_required_field_boundaries_use_trimmed_character_count(self):
        cases = [
            ("company_name", 100, "社"),
            ("motivation", 4_000, "動"),
        ]

        for index, (field, maximum, character) in enumerate(cases):
            with self.subTest(field=field, boundary="maximum"):
                value = f"  {character * maximum}  "
                response = self.post_company(
                    company_name=f"境界値企業{index}" if field != "company_name" else value,
                    motivation=value if field == "motivation" else "志望動機",
                )
                self.assertEqual(response.status_code, 201, response.text)
                self.assertEqual(response.json()[field], character * maximum)

            with self.subTest(field=field, boundary="over"):
                value = f"  {character * (maximum + 1)}  "
                response = self.post_company(
                    company_name=f"超過企業{index}" if field != "company_name" else value,
                    motivation=value if field == "motivation" else "志望動機",
                )
                self.assertEqual(response.status_code, 422, response.text)

    def test_optional_field_boundaries_and_job_summary_exception(self):
        url_prefix = "https://example.com/"
        cases = [
            ("company_url", 2_048, url_prefix + "a" * (2_048 - len(url_prefix))),
            ("resume", 10_000, "歴" * 10_000),
            ("note", 2_000, "備" * 2_000),
        ]

        for index, (field, maximum, value) in enumerate(cases):
            with self.subTest(field=field, boundary="maximum"):
                response = self.post_company(
                    company_name=f"任意項目境界値企業{index}",
                    **{field: f"  {value}  "},
                )
                self.assertEqual(response.status_code, 201, response.text)
                expected = value if field == "company_url" else f"  {value}  "
                self.assertEqual(response.json()[field], expected)

            with self.subTest(field=field, boundary="over"):
                over = (
                    url_prefix + "a" * (maximum + 1 - len(url_prefix))
                    if field == "company_url"
                    else value + value[-1]
                )
                response = self.post_company(
                    company_name=f"任意項目超過企業{index}",
                    **{field: f"  {over}  "},
                )
                self.assertEqual(response.status_code, 422, response.text)

        summary = "要" * 4_001
        response = self.post_company(
            company_name="要約超過許容企業", job_summary=f"  {summary}  "
        )
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(response.json()["job_summary"], f"  {summary}  ")

        updated_summary = "更" * 4_002
        update_response = self.client.put(
            f"/companies/{response.json()['id']}",
            json={
                "company_name": "要約超過許容企業",
                "motivation": "志望動機",
                "job_summary": updated_summary,
            },
        )
        self.assertEqual(update_response.status_code, 200, update_response.text)
        self.assertEqual(update_response.json()["job_summary"], updated_summary)

    def test_optional_fields_accept_omitted_null_and_normalize_blank_to_null(self):
        omitted = self.post_company(company_name="任意項目省略企業")
        explicit_null = self.post_company(
            company_name="任意項目null企業",
            company_url=None,
            resume=None,
            note=None,
            job_summary=None,
        )
        blank = self.post_company(
            company_name="任意項目空白企業",
            company_url="  \n",
            resume="  \t",
            note=" ",
            job_summary="\n",
        )

        for response in (omitted, explicit_null, blank):
            self.assertEqual(response.status_code, 201, response.text)
            for field in ("company_url", "resume", "note", "job_summary"):
                self.assertIsNone(response.json()[field])

    def test_company_url_rejects_non_http_and_invalid_urls(self):
        for index, company_url in enumerate(
            ["ftp://example.com/jobs", "https://", "not a url"]
        ):
            with self.subTest(company_url=company_url):
                response = self.post_company(
                    company_name=f"URL不正企業{index}", company_url=company_url
                )
                self.assertEqual(response.status_code, 422, response.text)


if __name__ == "__main__":
    unittest.main()
