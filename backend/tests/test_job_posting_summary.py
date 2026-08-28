import os
import socket
import unittest
from unittest.mock import Mock, patch

from fastapi.testclient import TestClient


os.environ["JWT_SECRET_KEY"] = "test-secret"

from app.main import create_app
from app.routers import auth
from app.services import job_posting, llm


TEST_URL = "https://jobs.example.test/openings/backend"
PUBLIC_DNS_RECORD = (
    socket.AF_INET,
    socket.SOCK_STREAM,
    socket.IPPROTO_TCP,
    "",
    ("1.1.1.1", 443),
)


class _FakeResponse:
    def __init__(self, status=200, headers=None, body=b""):
        self.status = status
        self.headers = headers or {}
        self._body = body
        self._offset = 0

    def getheader(self, name):
        return next(
            (value for key, value in self.headers.items() if key.lower() == name.lower()),
            None,
        )

    def read(self, size=-1):
        if size < 0:
            size = len(self._body) - self._offset
        result = self._body[self._offset : self._offset + size]
        self._offset += len(result)
        return result


class _FakeConnection:
    def __init__(self, response=None, request_error=None):
        self.response = response
        self.request_error = request_error
        self.closed = False
        self.request_args = None

    def request(self, *args, **kwargs):
        self.request_args = (args, kwargs)
        if self.request_error:
            raise self.request_error

    def getresponse(self):
        return self.response

    def close(self):
        self.closed = True


class JobPostingSummaryApiTest(unittest.TestCase):
    def setUp(self):
        self.app = create_app([])
        self.app.dependency_overrides[auth.get_current_user] = lambda: object()
        self.client = TestClient(self.app)

    def tearDown(self):
        self.app.dependency_overrides.clear()

    @patch("app.routers.job_postings.llm.summarize_job_posting")
    @patch("app.routers.job_postings.job_posting.fetch_and_extract")
    def test_success_returns_summary_without_saving_source(
        self, fetch_and_extract, summarize
    ):
        fetch_and_extract.return_value = "募集職種 バックエンドエンジニア"
        summarize.return_value = "バックエンド開発を担当する募集です。"

        response = self.client.post(
            "/job-postings/summary", json={"company_url": TEST_URL}
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(), {"summary": "バックエンド開発を担当する募集です。"}
        )
        fetch_and_extract.assert_called_once_with(TEST_URL)
        summarize.assert_called_once_with("募集職種 バックエンドエンジニア")

    def test_authentication_is_required(self):
        app = create_app([])
        response = TestClient(app).post(
            "/job-postings/summary", json={"company_url": TEST_URL}
        )
        self.assertEqual(response.status_code, 401)

    def test_invalid_request_uses_fixed_error_contract(self):
        invalid_bodies = [
            None,
            {},
            {"company_url": ""},
            {"company_url": None},
            {"company_url": 123},
            {"company_url": "ftp://jobs.example.test/opening"},
            {"company_url": "https://jobs.example.test/has a space"},
            {"company_url": "https://jobs.example.test/" + "a" * 2048},
        ]
        expected = {
            "detail": {
                "code": "invalid_url",
                "message": "有効なHTTP(S) URLを指定してください。",
            }
        }
        for body in invalid_bodies:
            with self.subTest(body=body):
                response = self.client.post("/job-postings/summary", json=body)
                self.assertEqual(response.status_code, 422)
                self.assertEqual(response.json(), expected)

        malformed = self.client.post(
            "/job-postings/summary",
            content="{",
            headers={"Content-Type": "application/json"},
        )
        self.assertEqual(malformed.status_code, 422)
        self.assertEqual(malformed.json(), expected)

    @patch("app.routers.job_postings.llm.summarize_job_posting")
    @patch("app.routers.job_postings.job_posting.fetch_and_extract")
    def test_fetch_and_extraction_failures_follow_contract(self, fetch, summarize):
        cases = [
            (
                job_posting.InvalidUrlError(),
                422,
                "invalid_url",
                "有効なHTTP(S) URLを指定してください。",
            ),
            (
                job_posting.UrlNotAllowedError(),
                422,
                "url_not_allowed",
                "指定されたURLにはアクセスできません。",
            ),
            (
                job_posting.FetchFailedError(),
                502,
                "fetch_failed",
                "募集要項を取得できませんでした。",
            ),
            (
                job_posting.UnsupportedContentError(),
                422,
                "unsupported_content",
                "このページは募集要項の要約に対応していません。",
            ),
            (
                job_posting.ExtractionFailedError(),
                422,
                "extraction_failed",
                "募集要項の本文を抽出できませんでした。",
            ),
        ]

        for error, status_code, code, message in cases:
            with self.subTest(code=code):
                fetch.reset_mock(side_effect=True)
                summarize.reset_mock(side_effect=True)
                fetch.side_effect = error
                response = self.client.post(
                    "/job-postings/summary", json={"company_url": TEST_URL}
                )
                self.assertEqual(response.status_code, status_code)
                self.assertEqual(
                    response.json(), {"detail": {"code": code, "message": message}}
                )
                summarize.assert_not_called()

    @patch("app.routers.job_postings.llm.summarize_job_posting")
    @patch("app.routers.job_postings.job_posting.fetch_and_extract")
    def test_llm_failure_and_empty_response_follow_contract(self, fetch, summarize):
        fetch.return_value = "十分な長さの募集要項本文です。職務内容と応募条件を含みます。"
        for llm_result in [RuntimeError("provider failure"), "   "]:
            with self.subTest(llm_result=llm_result):
                if isinstance(llm_result, Exception):
                    summarize.side_effect = llm_result
                    summarize.return_value = None
                else:
                    summarize.side_effect = None
                    summarize.return_value = llm_result
                response = self.client.post(
                    "/job-postings/summary", json={"company_url": TEST_URL}
                )
                self.assertEqual(response.status_code, 503)
                self.assertEqual(
                    response.json(),
                    {
                        "detail": {
                            "code": "summary_failed",
                            "message": "募集要項の要約を生成できませんでした。",
                        }
                    },
                )


class SafeFetchTest(unittest.TestCase):
    def test_localhost_and_non_public_literal_addresses_are_rejected(self):
        urls = [
            "http://localhost/jobs",
            "http://jobs.localhost/opening",
            "http://127.0.0.1/jobs",
            "http://10.0.0.1/jobs",
            "http://172.16.0.1/jobs",
            "http://192.168.0.1/jobs",
            "http://100.64.0.1/jobs",
            "http://169.254.169.254/latest/meta-data",
            "http://192.0.2.1/jobs",
            "http://224.0.0.1/jobs",
            "http://240.0.0.1/jobs",
            "http://255.255.255.255/jobs",
            "http://[::1]/jobs",
            "http://[fe80::1]/jobs",
            "http://[fd00::1]/jobs",
            "http://[ff02::1]/jobs",
            "http://[::ffff:127.0.0.1]/jobs",
            "http://[64:ff9b::a00:1]/jobs",
            "http://[64:ff9b:1::1]/jobs",
            "http://0.0.0.0/jobs",
        ]
        with patch("app.services.job_posting._request_once") as request_once:
            for url in urls:
                with self.subTest(url=url), self.assertRaises(
                    job_posting.UrlNotAllowedError
                ) as raised:
                    job_posting.fetch_html(url)
                self.assertNotIn(url, str(raised.exception))
            request_once.assert_not_called()

    @patch("app.services.job_posting._request_once")
    @patch("app.services.job_posting.socket.getaddrinfo")
    def test_private_or_mixed_dns_answers_are_rejected(self, getaddrinfo, request_once):
        private_record = (
            socket.AF_INET,
            socket.SOCK_STREAM,
            socket.IPPROTO_TCP,
            "",
            ("10.0.0.5", 443),
        )
        for records in [[private_record], [PUBLIC_DNS_RECORD, private_record]]:
            with self.subTest(records=records):
                getaddrinfo.return_value = records
                with self.assertRaises(job_posting.UrlNotAllowedError):
                    job_posting.fetch_html(TEST_URL)
        request_once.assert_not_called()

    @patch("app.services.job_posting._request_once")
    @patch("app.services.job_posting.socket.getaddrinfo")
    def test_legacy_numeric_hostname_resolving_to_loopback_is_rejected(
        self, getaddrinfo, request_once
    ):
        getaddrinfo.return_value = [
            (
                socket.AF_INET,
                socket.SOCK_STREAM,
                socket.IPPROTO_TCP,
                "",
                ("127.0.0.1", 80),
            )
        ]
        for url in ["http://2130706433/jobs", "http://0x7f000001/jobs"]:
            with self.subTest(url=url), self.assertRaises(
                job_posting.UrlNotAllowedError
            ):
                job_posting.fetch_html(url)
        request_once.assert_not_called()

    @patch("app.services.job_posting._request_once")
    @patch("app.services.job_posting.socket.getaddrinfo")
    def test_public_dns_answer_is_pinned_for_request(self, getaddrinfo, request_once):
        getaddrinfo.return_value = [PUBLIC_DNS_RECORD]
        request_once.return_value = job_posting._FetchResult(
            status=200,
            body="<main>十分な長さの募集要項本文です。</main>".encode(),
            charset="utf-8",
        )

        html = job_posting.fetch_html(TEST_URL)

        self.assertIn("募集要項", html)
        addresses = request_once.call_args.args[1]
        self.assertEqual(addresses, ("1.1.1.1",))

    @patch("app.services.job_posting._request_once")
    @patch("app.services.job_posting.socket.getaddrinfo")
    def test_redirect_destination_is_resolved_and_revalidated(
        self, getaddrinfo, request_once
    ):
        getaddrinfo.return_value = [PUBLIC_DNS_RECORD]
        request_once.return_value = job_posting._FetchResult(
            status=302, location="http://169.254.169.254/latest/meta-data"
        )

        with self.assertRaises(job_posting.UrlNotAllowedError):
            job_posting.fetch_html(TEST_URL)
        request_once.assert_called_once()

    @patch("app.services.job_posting._request_once")
    @patch("app.services.job_posting.socket.getaddrinfo")
    def test_same_host_dns_change_on_redirect_is_rejected(
        self, getaddrinfo, request_once
    ):
        private_record = (
            socket.AF_INET,
            socket.SOCK_STREAM,
            socket.IPPROTO_TCP,
            "",
            ("10.0.0.5", 443),
        )
        getaddrinfo.side_effect = [[PUBLIC_DNS_RECORD], [private_record]]
        request_once.return_value = job_posting._FetchResult(
            status=302, location="/redirected"
        )

        with self.assertRaises(job_posting.UrlNotAllowedError):
            job_posting.fetch_html(TEST_URL)
        request_once.assert_called_once()

    @patch("app.services.job_posting._request_once")
    @patch("app.services.job_posting.socket.getaddrinfo")
    def test_redirect_to_disallowed_scheme_is_rejected(self, getaddrinfo, request_once):
        getaddrinfo.return_value = [PUBLIC_DNS_RECORD]
        request_once.return_value = job_posting._FetchResult(
            status=302, location="file:///etc/passwd"
        )

        with self.assertRaises(job_posting.UrlNotAllowedError):
            job_posting.fetch_html(TEST_URL)

    @patch("app.services.job_posting._request_once")
    @patch("app.services.job_posting.socket.getaddrinfo")
    def test_malformed_redirect_location_is_rejected(self, getaddrinfo, request_once):
        getaddrinfo.return_value = [PUBLIC_DNS_RECORD]
        request_once.return_value = job_posting._FetchResult(
            status=302, location="http://[invalid"
        )

        with self.assertRaises(job_posting.UrlNotAllowedError):
            job_posting.fetch_html(TEST_URL)

    @patch("app.services.job_posting._request_once")
    @patch("app.services.job_posting.socket.getaddrinfo")
    def test_redirect_to_invalid_port_is_rejected(self, getaddrinfo, request_once):
        getaddrinfo.return_value = [PUBLIC_DNS_RECORD]
        request_once.return_value = job_posting._FetchResult(
            status=302, location="https://jobs.example.test:0/opening"
        )

        with self.assertRaises(job_posting.UrlNotAllowedError):
            job_posting.fetch_html(TEST_URL)

    def test_unicode_path_is_percent_encoded_before_request(self):
        target = job_posting._parse_target(
            "https://jobs.example.test/募集?職種=開発", is_redirect=False
        )
        self.assertEqual(
            target.request_target,
            "/%E5%8B%9F%E9%9B%86?%E8%81%B7%E7%A8%AE=%E9%96%8B%E7%99%BA",
        )

    @patch("app.services.job_posting._request_once")
    @patch("app.services.job_posting.socket.getaddrinfo")
    def test_allowed_redirect_is_resolved_again(self, getaddrinfo, request_once):
        getaddrinfo.return_value = [PUBLIC_DNS_RECORD]
        request_once.side_effect = [
            job_posting._FetchResult(status=302, location="/openings/canonical"),
            job_posting._FetchResult(
                status=200,
                body="<main>十分な長さの募集要項本文です。</main>".encode(),
                charset="utf-8",
            ),
        ]

        html = job_posting.fetch_html(TEST_URL)

        self.assertIn("募集要項", html)
        self.assertEqual(getaddrinfo.call_count, 2)
        self.assertEqual(request_once.call_count, 2)

    @patch("app.services.job_posting._request_once")
    @patch("app.services.job_posting.socket.getaddrinfo")
    def test_redirect_limit_is_enforced(self, getaddrinfo, request_once):
        getaddrinfo.return_value = [PUBLIC_DNS_RECORD]
        request_once.return_value = job_posting._FetchResult(
            status=302, location="/another-location"
        )

        with self.assertRaises(job_posting.UrlNotAllowedError):
            job_posting.fetch_html(TEST_URL)
        self.assertEqual(request_once.call_count, job_posting.MAX_REDIRECTS + 1)

    @patch("app.services.job_posting.socket.getaddrinfo")
    def test_dns_failure_becomes_fetch_failed_without_leaking_url(self, getaddrinfo):
        getaddrinfo.side_effect = socket.gaierror("lookup failed for sensitive host")
        with self.assertRaises(job_posting.FetchFailedError) as raised:
            job_posting.fetch_html(TEST_URL)
        self.assertNotIn(TEST_URL, str(raised.exception))

    @patch("app.services.job_posting._DNS_SLOTS")
    @patch("app.services.job_posting._DNS_EXECUTOR")
    def test_dns_timeout_becomes_fetch_failed(self, executor, dns_slots):
        future = Mock()
        future.result.side_effect = job_posting.FutureTimeoutError()
        executor.submit.return_value = future
        dns_slots.acquire.return_value = True
        target = job_posting._Target(
            "https", "jobs.example.test", 443, "/openings/backend", None
        )

        with self.assertRaises(job_posting.FetchFailedError):
            job_posting._resolve_public_addresses(
                target, job_posting.monotonic() + job_posting.DNS_TIMEOUT_SECONDS
            )
        future.cancel.assert_called_once()
        future.add_done_callback.assert_called_once()

    @patch("app.services.job_posting._DNS_SLOTS")
    @patch("app.services.job_posting._DNS_EXECUTOR")
    def test_dns_concurrency_limit_fails_closed(self, executor, dns_slots):
        dns_slots.acquire.return_value = False
        target = job_posting._Target(
            "https", "jobs.example.test", 443, "/openings/backend", None
        )

        with self.assertRaises(job_posting.FetchFailedError):
            job_posting._resolve_public_addresses(
                target, job_posting.monotonic() + job_posting.DNS_TIMEOUT_SECONDS
            )
        executor.submit.assert_not_called()

    @patch("app.services.job_posting._open_connection")
    def test_non_html_content_is_rejected_before_reading_body(self, open_connection):
        response = _FakeResponse(
            headers={"Content-Type": "application/pdf"}, body=b"not a real document"
        )
        connection = _FakeConnection(response=response)
        open_connection.return_value = connection
        target = job_posting._Target("https", "jobs.example.test", 443, "/jobs", None)

        with self.assertRaises(job_posting.UnsupportedContentError):
            job_posting._request_once(target, ("1.1.1.1",), job_posting.monotonic() + 1)
        self.assertEqual(response._offset, 0)
        self.assertTrue(connection.closed)

    @patch("app.services.job_posting._open_connection")
    def test_compressed_content_is_rejected(self, open_connection):
        response = _FakeResponse(
            headers={
                "Content-Type": "text/html",
                "Content-Encoding": "gzip",
            },
            body=b"compressed data",
        )
        open_connection.return_value = _FakeConnection(response=response)
        target = job_posting._Target("https", "jobs.example.test", 443, "/jobs", None)

        with self.assertRaises(job_posting.UnsupportedContentError):
            job_posting._request_once(target, ("1.1.1.1",), job_posting.monotonic() + 1)

    def test_pinned_connections_use_validated_ip_and_original_tls_hostname(self):
        raw_socket = Mock()
        tls_socket = Mock()
        tls_context = Mock()
        tls_context.wrap_socket.return_value = tls_socket

        with (
            patch("app.services.job_posting.socket.create_connection") as connect,
            patch(
                "app.services.job_posting.ssl.create_default_context",
                return_value=tls_context,
            ),
        ):
            connection = job_posting._PinnedHTTPSConnection(
                "jobs.example.test", 443, "1.1.1.1", 2.0
            )
            connect.return_value = raw_socket
            connection.connect()

        connect.assert_called_once_with(("1.1.1.1", 443), 2.0, None)
        tls_context.wrap_socket.assert_called_once_with(
            raw_socket, server_hostname="jobs.example.test"
        )
        self.assertIs(connection.sock, tls_socket)

    @patch("app.services.job_posting._open_connection")
    def test_content_length_and_streamed_size_limits_are_enforced(
        self, open_connection
    ):
        oversized_length = str(job_posting.MAX_RESPONSE_BYTES + 1)
        responses = [
            _FakeResponse(
                headers={
                    "Content-Type": "text/html",
                    "Content-Length": oversized_length,
                },
                body=b"small",
            ),
            _FakeResponse(
                headers={"Content-Type": "text/html"},
                body=b"x" * (job_posting.MAX_RESPONSE_BYTES + 1),
            ),
        ]
        target = job_posting._Target("https", "jobs.example.test", 443, "/jobs", None)

        for response in responses:
            with self.subTest(headers=response.headers):
                open_connection.return_value = _FakeConnection(response=response)
                with self.assertRaises(job_posting.UnsupportedContentError):
                    job_posting._request_once(
                        target, ("1.1.1.1",), job_posting.monotonic() + 1
                    )

    @patch("app.services.job_posting._open_connection")
    def test_socket_timeout_becomes_fetch_failed(self, open_connection):
        open_connection.return_value = _FakeConnection(request_error=socket.timeout())
        target = job_posting._Target("https", "jobs.example.test", 443, "/jobs", None)
        with self.assertRaises(job_posting.FetchFailedError):
            job_posting._request_once(target, ("1.1.1.1",), job_posting.monotonic() + 1)

    def test_credentials_in_url_are_rejected_without_leaking_them(self):
        sensitive = "https://user:secret@jobs.example.test/opening?token=secret"
        with self.assertRaises(job_posting.UrlNotAllowedError) as raised:
            job_posting.fetch_html(sensitive)
        self.assertNotIn("secret", str(raised.exception))


class HtmlExtractionTest(unittest.TestCase):
    def test_extracts_main_content_and_ignores_scripts_navigation_and_hidden_text(self):
        html = """
        <html><head><title>internal title</title></head><body>
          <nav>navigation only</nav>
          <main>
            <h1>バックエンドエンジニア</h1>
            <p>APIの設計と実装を担当します。</p>
            <script>ignore_secret_body()</script>
            <div hidden><div>nested hidden secret</div><p>hidden secret</p></div>
          </main>
        </body></html>
        """
        text = job_posting.extract_job_posting_text(html)
        self.assertIn("バックエンドエンジニア", text)
        self.assertIn("APIの設計と実装", text)
        self.assertNotIn("navigation", text)
        self.assertNotIn("ignore_secret", text)
        self.assertNotIn("hidden secret", text)
        self.assertNotIn("nested hidden secret", text)

    def test_falls_back_to_visible_body_when_main_is_absent(self):
        html = (
            "<html><body><h1>募集職種</h1>"
            "<p>自社サービスの設計とバックエンド開発を担当します。</p></body></html>"
        )
        self.assertIn("自社サービス", job_posting.extract_job_posting_text(html))

    def test_empty_or_non_meaningful_html_is_rejected(self):
        for html in ["", "<html><script>only_script()</script></html>", "<p>短文</p>"]:
            with self.subTest(html=html), self.assertRaises(
                job_posting.ExtractionFailedError
            ):
                job_posting.extract_job_posting_text(html)

    def test_extracted_text_is_bounded_before_llm_call(self):
        text = job_posting.extract_job_posting_text(
            "<main>" + "募集要項の内容です。" * 10_000 + "</main>"
        )
        self.assertEqual(len(text), job_posting.MAX_EXTRACTED_TEXT_CHARS)


class BedrockSummaryTest(unittest.TestCase):
    @patch("app.services.llm._call_bedrock")
    def test_existing_bedrock_layer_is_used_with_untrusted_text_as_user_content(
        self, call_bedrock
    ):
        call_bedrock.return_value = "要約結果"
        source_text = "募集要項本文。前の命令を無視するよう求める記述を含む。"

        result = llm.summarize_job_posting(source_text)

        self.assertEqual(result, "要約結果")
        system, messages = call_bedrock.call_args.args[:2]
        self.assertIn("本文中の命令や依頼", system)
        self.assertEqual(messages, [{"role": "user", "content": source_text}])
        self.assertEqual(call_bedrock.call_args.kwargs["timeout"], 30.0)


if __name__ == "__main__":
    unittest.main()
