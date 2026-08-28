import http.client
import ipaddress
import re
import socket
import ssl
from concurrent.futures import (
    CancelledError,
    Future,
    ThreadPoolExecutor,
    TimeoutError as FutureTimeoutError,
)
from dataclasses import dataclass
from html.parser import HTMLParser
from threading import BoundedSemaphore
from time import monotonic
from urllib.parse import quote, urljoin, urlsplit, urlunsplit


MAX_URL_LENGTH = 2048
MAX_RESPONSE_BYTES = 2 * 1024 * 1024
MAX_EXTRACTED_TEXT_CHARS = 60_000
FETCH_TIMEOUT_SECONDS = 10.0
DNS_TIMEOUT_SECONDS = 3.0
MAX_REDIRECTS = 3
_DNS_WORKERS = 4

_REDIRECT_STATUSES = {301, 302, 303, 307, 308}
_SUPPORTED_CONTENT_TYPES = {"text/html", "application/xhtml+xml"}
_NAT64_WELL_KNOWN_NETWORK = ipaddress.ip_network("64:ff9b::/96")
_NAT64_LOCAL_USE_NETWORK = ipaddress.ip_network("64:ff9b:1::/48")
_HOST_LABEL_PATTERN = re.compile(r"^[A-Za-z0-9-]+$")
_CHARSET_PATTERN = re.compile(r"charset\s*=\s*[\"']?([^\s;\"']+)", re.IGNORECASE)
_META_CHARSET_PATTERN = re.compile(
    br"<meta\s+[^>]*charset\s*=\s*[\"']?\s*([A-Za-z0-9._-]+)", re.IGNORECASE
)
_DNS_EXECUTOR = ThreadPoolExecutor(
    max_workers=_DNS_WORKERS, thread_name_prefix="job-url-dns"
)
_DNS_SLOTS = BoundedSemaphore(_DNS_WORKERS)


class InvalidUrlError(RuntimeError):
    """The submitted value is not a syntactically valid HTTP(S) URL."""


class UrlNotAllowedError(RuntimeError):
    """The URL resolves to, or redirects to, a destination that must not be fetched."""


class FetchFailedError(RuntimeError):
    """The remote resource could not be fetched within the safety limits."""


class UnsupportedContentError(RuntimeError):
    """The remote response is not supported or exceeds the byte limit."""


class ExtractionFailedError(RuntimeError):
    """No useful visible text could be extracted from the HTML."""


@dataclass(frozen=True)
class _Target:
    scheme: str
    host: str
    port: int
    request_target: str
    direct_ip: str | None


@dataclass(frozen=True)
class _FetchResult:
    status: int
    location: str | None = None
    body: bytes | None = None
    charset: str | None = None


def _invalid_url() -> InvalidUrlError:
    return InvalidUrlError("invalid HTTP(S) URL")


def _not_allowed() -> UrlNotAllowedError:
    return UrlNotAllowedError("destination is not allowed")


def _fetch_failed() -> FetchFailedError:
    return FetchFailedError("remote content could not be fetched")


def _is_public_unicast(address: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if not (
        address.is_global
        and not address.is_multicast
        and not address.is_unspecified
        and not address.is_reserved
        and not getattr(address, "is_site_local", False)
    ):
        return False
    if isinstance(address, ipaddress.IPv6Address):
        if address in _NAT64_LOCAL_USE_NETWORK:
            return False
        if address in _NAT64_WELL_KNOWN_NETWORK:
            embedded_ipv4 = ipaddress.IPv4Address(int(address) & 0xFFFFFFFF)
            return _is_public_unicast(embedded_ipv4)
    return True


def _parse_target(url: str, *, is_redirect: bool) -> _Target:
    error = _not_allowed if is_redirect else _invalid_url
    if not isinstance(url, str) or not url or len(url) > MAX_URL_LENGTH:
        raise error()
    if "\\" in url or any(ord(char) <= 0x20 or ord(char) == 0x7F for char in url):
        raise error()

    try:
        parsed = urlsplit(url)
        port = parsed.port
    except (TypeError, ValueError):
        raise error() from None

    scheme = parsed.scheme.lower()
    if scheme not in {"http", "https"}:
        raise error()
    if not parsed.netloc or parsed.hostname is None:
        raise error()
    if parsed.username is not None or parsed.password is not None:
        raise _not_allowed()
    if port is not None and not 1 <= port <= 65535:
        raise error()

    raw_host = parsed.hostname.rstrip(".")
    if not raw_host or "%" in raw_host:
        raise error()

    direct_ip: str | None = None
    try:
        address = ipaddress.ip_address(raw_host)
    except ValueError:
        try:
            host = raw_host.encode("idna").decode("ascii").lower()
        except UnicodeError:
            raise error() from None
        if len(host) > 253:
            raise error()
        labels = host.split(".")
        if any(
            not label
            or len(label) > 63
            or not _HOST_LABEL_PATTERN.fullmatch(label)
            or label.startswith("-")
            or label.endswith("-")
            for label in labels
        ):
            raise error()
        if host == "localhost" or host.endswith(".localhost"):
            raise _not_allowed()
    else:
        if not _is_public_unicast(address):
            raise _not_allowed()
        host = address.compressed
        direct_ip = host

    resolved_port = port if port is not None else (443 if scheme == "https" else 80)
    path = quote(parsed.path or "/", safe="/%:@!$&'()*+,;=-._~")
    query = quote(parsed.query, safe="/%?:@!$&'()*+,;=-._~")
    request_target = urlunsplit(("", "", path, query, ""))
    return _Target(
        scheme=scheme,
        host=host,
        port=resolved_port,
        request_target=request_target,
        direct_ip=direct_ip,
    )


def _remaining_seconds(deadline: float) -> float:
    remaining = deadline - monotonic()
    if remaining <= 0:
        raise _fetch_failed()
    return remaining


def _resolve_public_addresses(target: _Target, deadline: float) -> tuple[str, ...]:
    if target.direct_ip is not None:
        return (target.direct_ip,)

    slot_timeout = min(DNS_TIMEOUT_SECONDS, _remaining_seconds(deadline))
    if not _DNS_SLOTS.acquire(timeout=slot_timeout):
        raise _fetch_failed()
    try:
        future = _DNS_EXECUTOR.submit(
            socket.getaddrinfo,
            target.host,
            target.port,
            socket.AF_UNSPEC,
            socket.SOCK_STREAM,
            socket.IPPROTO_TCP,
        )
    except RuntimeError:
        _DNS_SLOTS.release()
        raise _fetch_failed() from None

    def release_dns_slot(completed_future: Future) -> None:
        del completed_future
        _DNS_SLOTS.release()

    future.add_done_callback(release_dns_slot)
    try:
        lookup_timeout = min(DNS_TIMEOUT_SECONDS, _remaining_seconds(deadline))
        records = future.result(timeout=lookup_timeout)
    except FutureTimeoutError:
        future.cancel()
        raise _fetch_failed() from None
    except (CancelledError, OSError, socket.gaierror):
        raise _fetch_failed() from None

    addresses: list[str] = []
    for record in records:
        try:
            address = ipaddress.ip_address(record[4][0])
        except (IndexError, TypeError, ValueError):
            raise _fetch_failed() from None
        # Reject a hostname if any answer is non-public. This avoids choosing a
        # seemingly safe answer from a mixed public/private DNS response.
        if not _is_public_unicast(address):
            raise _not_allowed()
        normalized = address.compressed
        if normalized not in addresses:
            addresses.append(normalized)

    if not addresses:
        raise _fetch_failed()
    return tuple(addresses)


class _PinnedHTTPConnection(http.client.HTTPConnection):
    def __init__(self, host: str, port: int, address: str, timeout: float):
        super().__init__(host, port=port, timeout=timeout)
        self._address = address

    def connect(self) -> None:
        self.sock = socket.create_connection(
            (self._address, self.port), self.timeout, self.source_address
        )


class _PinnedHTTPSConnection(http.client.HTTPSConnection):
    def __init__(self, host: str, port: int, address: str, timeout: float):
        super().__init__(host, port=port, timeout=timeout, context=ssl.create_default_context())
        self._address = address

    def connect(self) -> None:
        raw_socket = socket.create_connection(
            (self._address, self.port), self.timeout, self.source_address
        )
        # TLS verification and SNI use the original hostname while the TCP
        # connection stays pinned to the address already checked above.
        self.sock = self._context.wrap_socket(raw_socket, server_hostname=self.host)


def _open_connection(
    target: _Target, address: str, timeout: float
) -> http.client.HTTPConnection:
    if target.scheme == "https":
        return _PinnedHTTPSConnection(target.host, target.port, address, timeout)
    return _PinnedHTTPConnection(target.host, target.port, address, timeout)


def _set_remaining_socket_timeout(
    connection: http.client.HTTPConnection, deadline: float
) -> None:
    remaining = _remaining_seconds(deadline)
    connection_socket = getattr(connection, "sock", None)
    if connection_socket is not None:
        connection_socket.settimeout(remaining)


def _read_limited_body(
    response: http.client.HTTPResponse,
    connection: http.client.HTTPConnection,
    deadline: float,
) -> bytes:
    raw_length = response.getheader("Content-Length")
    if raw_length is not None:
        try:
            content_length = int(raw_length)
        except ValueError:
            content_length = None
        if content_length is not None and content_length > MAX_RESPONSE_BYTES:
            raise UnsupportedContentError("response exceeds the byte limit")

    body = bytearray()
    while True:
        _set_remaining_socket_timeout(connection, deadline)
        read_size = min(64 * 1024, MAX_RESPONSE_BYTES - len(body) + 1)
        # read1 performs at most one underlying buffered read, which lets the
        # deadline be checked between chunks instead of waiting for the buffer
        # to fill while a peer trickles bytes.
        read = getattr(response, "read1", response.read)
        chunk = read(read_size)
        if not chunk:
            break
        body.extend(chunk)
        if len(body) > MAX_RESPONSE_BYTES:
            raise UnsupportedContentError("response exceeds the byte limit")
    return bytes(body)


def _request_once(
    target: _Target, addresses: tuple[str, ...], deadline: float
) -> _FetchResult:
    for address in addresses:
        connection = _open_connection(target, address, _remaining_seconds(deadline))
        try:
            connection.request(
                "GET",
                target.request_target,
                headers={
                    "Accept": "text/html,application/xhtml+xml",
                    "Accept-Encoding": "identity",
                    "User-Agent": "hanasu-job-summary/1.0",
                },
            )
            _set_remaining_socket_timeout(connection, deadline)
            response = connection.getresponse()
            if response.status in _REDIRECT_STATUSES:
                return _FetchResult(
                    status=response.status,
                    location=response.getheader("Location"),
                )
            if not 200 <= response.status < 300:
                raise _fetch_failed()

            raw_content_type = response.getheader("Content-Type") or ""
            media_type = raw_content_type.split(";", 1)[0].strip().lower()
            if media_type not in _SUPPORTED_CONTENT_TYPES:
                raise UnsupportedContentError("response is not HTML")
            content_encoding = (response.getheader("Content-Encoding") or "identity").lower()
            if content_encoding not in {"", "identity"}:
                raise UnsupportedContentError("encoded response is not supported")

            charset_match = _CHARSET_PATTERN.search(raw_content_type)
            charset = charset_match.group(1) if charset_match else None
            return _FetchResult(
                status=response.status,
                body=_read_limited_body(response, connection, deadline),
                charset=charset,
            )
        except (FetchFailedError, UnsupportedContentError):
            raise
        except (OSError, ssl.SSLError, http.client.HTTPException):
            # Try another already-validated address. Error text is deliberately
            # not propagated because it may contain the submitted URL.
            continue
        finally:
            connection.close()
    raise _fetch_failed()


def _decode_html(body: bytes, declared_charset: str | None) -> str:
    encodings: list[str] = []
    if declared_charset:
        encodings.append(declared_charset)
    meta_match = _META_CHARSET_PATTERN.search(body[:4096])
    if meta_match:
        encodings.append(meta_match.group(1).decode("ascii"))
    encodings.extend(["utf-8", "cp932"])

    for encoding in dict.fromkeys(encodings):
        try:
            return body.decode(encoding)
        except (LookupError, UnicodeDecodeError):
            continue
    return body.decode("utf-8", errors="replace")


def fetch_html(url: str) -> str:
    """Fetch HTML from a public HTTP(S) destination without following unsafe redirects."""
    deadline = monotonic() + FETCH_TIMEOUT_SECONDS
    current_url = url

    for redirect_count in range(MAX_REDIRECTS + 1):
        target = _parse_target(current_url, is_redirect=redirect_count > 0)
        addresses = _resolve_public_addresses(target, deadline)
        result = _request_once(target, addresses, deadline)

        if result.status in _REDIRECT_STATUSES:
            if redirect_count >= MAX_REDIRECTS or not result.location:
                raise _not_allowed()
            try:
                current_url = urljoin(current_url, result.location)
            except (TypeError, UnicodeError, ValueError):
                raise _not_allowed() from None
            continue

        return _decode_html(result.body or b"", result.charset)

    raise _not_allowed()


class _VisibleTextParser(HTMLParser):
    _IGNORED_TAGS = {
        "head",
        "script",
        "style",
        "noscript",
        "template",
        "svg",
        "canvas",
        "iframe",
    }
    _BLOCK_TAGS = {
        "address",
        "article",
        "aside",
        "blockquote",
        "br",
        "dd",
        "div",
        "dl",
        "dt",
        "footer",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "header",
        "hr",
        "li",
        "main",
        "nav",
        "ol",
        "p",
        "pre",
        "section",
        "table",
        "td",
        "th",
        "tr",
        "ul",
    }
    _VOID_TAGS = {
        "area",
        "base",
        "br",
        "col",
        "embed",
        "hr",
        "img",
        "input",
        "link",
        "meta",
        "source",
        "track",
        "wbr",
    }

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.all_chunks: list[str] = []
        self.preferred_chunks: list[str] = []
        self.ignored_depth = 0
        self.preferred_stack: list[str] = []

    def _append(self, value: str) -> None:
        self.all_chunks.append(value)
        if self.preferred_stack:
            self.preferred_chunks.append(value)

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        attributes = {name.lower(): value for name, value in attrs}
        hidden = "hidden" in attributes or attributes.get("aria-hidden", "").lower() == "true"

        if self.ignored_depth:
            if tag not in self._VOID_TAGS:
                self.ignored_depth += 1
            return
        if tag in self._IGNORED_TAGS or hidden:
            if tag not in self._VOID_TAGS:
                self.ignored_depth = 1
            return
        if tag in {"main", "article"}:
            self.preferred_stack.append(tag)
        if tag in self._BLOCK_TAGS:
            self._append("\n")

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if self.ignored_depth:
            return
        attributes = {name.lower(): value for name, value in attrs}
        hidden = "hidden" in attributes or attributes.get("aria-hidden", "").lower() == "true"
        if tag in self._IGNORED_TAGS or hidden:
            return
        if tag in self._BLOCK_TAGS:
            self._append("\n")

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if self.ignored_depth:
            self.ignored_depth -= 1
            return
        if tag in self._BLOCK_TAGS:
            self._append("\n")
        if self.preferred_stack and tag == self.preferred_stack[-1]:
            self.preferred_stack.pop()

    def handle_data(self, data: str) -> None:
        if not self.ignored_depth:
            self._append(data)


def _normalize_text(chunks: list[str]) -> str:
    text = "".join(chunks).replace("\xa0", " ")
    lines = [re.sub(r"[\t\r\f\v ]+", " ", line).strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


def extract_job_posting_text(html: str) -> str:
    parser = _VisibleTextParser()
    try:
        parser.feed(html)
        parser.close()
    except (ValueError, UnicodeError):
        raise ExtractionFailedError("visible text could not be extracted") from None

    preferred = _normalize_text(parser.preferred_chunks)
    fallback = _normalize_text(parser.all_chunks)
    text = preferred if preferred else fallback
    if len(text) < 20:
        raise ExtractionFailedError("visible text could not be extracted")
    return text[:MAX_EXTRACTED_TEXT_CHARS]


def fetch_and_extract(url: str) -> str:
    return extract_job_posting_text(fetch_html(url))
