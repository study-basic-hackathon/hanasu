import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

# app.security validates this environment variable while app.main is imported.
os.environ["JWT_SECRET_KEY"] = "test-secret"

from app.config import get_cors_allowed_origins
from app.main import create_app

LOCAL_ORIGIN = "http://localhost:3000"
AMPLIFY_ORIGIN = "https://main.example.amplifyapp.com"
UNALLOWED_ORIGIN = "https://example.invalid"


class CorsConfigTest(unittest.TestCase):
    def test_unset_environment_uses_localhost_only(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(get_cors_allowed_origins(), [LOCAL_ORIGIN])

    def test_empty_environment_uses_localhost_only(self):
        with patch.dict(os.environ, {"CORS_ALLOWED_ORIGINS": " ,  "}, clear=True):
            self.assertEqual(get_cors_allowed_origins(), [LOCAL_ORIGIN])

    def test_comma_separated_origins_are_trimmed_and_deduplicated(self):
        configured_origins = f" {LOCAL_ORIGIN}, {AMPLIFY_ORIGIN}, {LOCAL_ORIGIN} "

        with patch.dict(
            os.environ, {"CORS_ALLOWED_ORIGINS": configured_origins}, clear=True
        ):
            self.assertEqual(get_cors_allowed_origins(), [LOCAL_ORIGIN, AMPLIFY_ORIGIN])

    def test_wildcard_origin_is_rejected(self):
        with (
            patch.dict(os.environ, {"CORS_ALLOWED_ORIGINS": "*"}, clear=True),
            self.assertRaisesRegex(RuntimeError, "\\*.*指定できません"),
        ):
            get_cors_allowed_origins()


class CorsMiddlewareTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(create_app([LOCAL_ORIGIN, AMPLIFY_ORIGIN]))

    def test_allowed_origin_is_returned(self):
        response = self.client.get("/health", headers={"Origin": AMPLIFY_ORIGIN})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.headers["access-control-allow-origin"], AMPLIFY_ORIGIN
        )
        self.assertEqual(response.headers["access-control-allow-credentials"], "true")

    def test_unallowed_origin_is_not_returned(self):
        response = self.client.get("/health", headers={"Origin": UNALLOWED_ORIGIN})

        self.assertEqual(response.status_code, 200)
        self.assertNotIn("access-control-allow-origin", response.headers)

    def test_unset_environment_applies_localhost_only_to_middleware(self):
        with patch.dict(os.environ, {}, clear=True):
            client = TestClient(create_app())

        allowed_response = client.get("/health", headers={"Origin": LOCAL_ORIGIN})
        unallowed_response = client.get("/health", headers={"Origin": UNALLOWED_ORIGIN})

        self.assertEqual(
            allowed_response.headers["access-control-allow-origin"], LOCAL_ORIGIN
        )
        self.assertNotIn("access-control-allow-origin", unallowed_response.headers)

    def test_preflight_allows_authorization_and_content_type_headers(self):
        response = self.client.options(
            "/token",
            headers={
                "Origin": LOCAL_ORIGIN,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization,content-type",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["access-control-allow-origin"], LOCAL_ORIGIN)
        self.assertEqual(response.headers["access-control-allow-credentials"], "true")
        allowed_headers = {
            header.strip().lower()
            for header in response.headers["access-control-allow-headers"].split(",")
        }
        self.assertTrue({"authorization", "content-type"} <= allowed_headers)

    def test_preflight_rejects_unallowed_origin(self):
        response = self.client.options(
            "/token",
            headers={
                "Origin": UNALLOWED_ORIGIN,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization,content-type",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertNotIn("access-control-allow-origin", response.headers)


if __name__ == "__main__":
    unittest.main()
