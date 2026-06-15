"""Network module for just-bash."""

from __future__ import annotations

import asyncio
import ipaddress
import socket
from collections.abc import Sequence
from typing import Any
from urllib.parse import SplitResult, urljoin, urlsplit

import httpcore
import httpx

from ..types import AllowedUrl, NetworkConfig, RequestTransform

_ALLOWED_SCHEMES = {"http", "https"}
_BODY_CHUNK_SIZE = 64 * 1024
_INVALID_ALLOW_LIST_ENTRY = (
    'Invalid allow-list entry: must be a string URL or an object with a "url" string property'
)


class NetworkAccessDeniedError(Exception):
    """Raised when a URL is outside the configured network policy."""

    def __init__(self, url: str, reason: str = "URL not in allow-list") -> None:
        super().__init__(f"Network access denied: {reason}: {url}")


class MethodNotAllowedError(Exception):
    """Raised when an HTTP method is outside the configured network policy."""

    def __init__(self, method: str, allowed_methods: list[str]) -> None:
        super().__init__(
            f"HTTP method '{method}' not allowed. Allowed methods: {', '.join(allowed_methods)}"
        )


class RedirectNotAllowedError(Exception):
    """Raised when a redirect target is outside the configured network policy."""

    def __init__(self, url: str) -> None:
        super().__init__(f"Redirect target not in allow-list: {url}")


class TooManyRedirectsError(Exception):
    """Raised when a request exceeds the configured redirect limit."""

    def __init__(self, max_redirects: int) -> None:
        super().__init__(f"Too many redirects (max: {max_redirects})")


class ResponseTooLargeError(Exception):
    """Raised when a response exceeds the configured size limit."""

    def __init__(self, max_size: int) -> None:
        super().__init__(f"Response body too large (max: {max_size} bytes)")


def _entry_url(entry: str | AllowedUrl | dict[str, Any]) -> str:
    if isinstance(entry, str):
        return entry
    if isinstance(entry, dict):
        return str(entry.get("url", ""))
    return entry.url


def _default_port(scheme: str) -> int | None:
    if scheme == "http":
        return 80
    if scheme == "https":
        return 443
    return None


def _parse_http_url(url: str) -> SplitResult | None:
    try:
        parsed = urlsplit(url)
        # Accessing .port validates malformed ports.
        _ = parsed.port
    except ValueError:
        return None
    if parsed.scheme.lower() not in _ALLOWED_SCHEMES or not parsed.hostname:
        return None
    return parsed


def _normalized_origin(parsed: SplitResult) -> tuple[str, str, int]:
    scheme = parsed.scheme.lower()
    port = parsed.port or _default_port(scheme)
    if port is None:
        # _parse_http_url guarantees this is unreachable for callers.
        raise ValueError(f"unsupported URL scheme: {parsed.scheme}")
    return scheme, (parsed.hostname or "").lower(), port


def _has_ambiguous_path_separators(path: str) -> bool:
    normalized = path.lower()
    return "\\" in path or "%2f" in normalized or "%5c" in normalized


def _path_matches(path: str, prefix: str) -> bool:
    if prefix in ("", "/"):
        return True
    if _has_ambiguous_path_separators(path):
        return False
    if prefix.endswith("/"):
        return path.startswith(prefix)
    return path == prefix or path.startswith(f"{prefix}/")


def _matches_allow_entry(url: str, allowed_entry: str) -> bool:
    parsed_url = _parse_http_url(url)
    parsed_allowed = _parse_http_url(allowed_entry)
    if parsed_url is None or parsed_allowed is None:
        return False
    if _normalized_origin(parsed_url) != _normalized_origin(parsed_allowed):
        return False
    return _path_matches(parsed_url.path or "/", parsed_allowed.path or "/")


def _validate_allow_list(entries: list[str | AllowedUrl | dict[str, Any]]) -> list[str]:
    errors: list[str] = []
    for raw_entry in entries:
        if isinstance(raw_entry, dict):
            entry = raw_entry.get("url")
        elif isinstance(raw_entry, str):
            entry = raw_entry
        elif isinstance(raw_entry, AllowedUrl):
            entry = raw_entry.url
        else:
            errors.append(_INVALID_ALLOW_LIST_ENTRY)
            continue

        if not isinstance(entry, str):
            errors.append(_INVALID_ALLOW_LIST_ENTRY)
            continue

        parsed = _parse_http_url(entry)
        if parsed is None:
            errors.append(
                f'Invalid URL in allow-list: "{entry}" - '
                "must be an http(s) URL with scheme and host"
            )
            continue

        if parsed.query or parsed.fragment:
            errors.append(
                f'Query strings and fragments are ignored in allow-list entries: "{entry}"'
            )
            continue

        path = parsed.path or "/"
        if path not in ("", "/") and _has_ambiguous_path_separators(path):
            errors.append(f'Allow-list entry contains ambiguous path separators: "{entry}"')
    return errors


def _parse_ipv4_component(part: str) -> int | None:
    if not part:
        return None
    base = 10
    digits = part
    if digits.startswith(("0x", "0X")):
        base = 16
        digits = digits[2:]
    elif len(digits) > 1 and digits.startswith("0"):
        base = 8
    try:
        value = int(digits, base)
    except ValueError:
        return None
    if value < 0:
        return None
    return value


def _parse_ipv4(host: str) -> ipaddress.IPv4Address | None:
    parts = host.split(".")
    if not parts or len(parts) > 4:
        return None
    nums = [_parse_ipv4_component(part) for part in parts]
    if any(num is None for num in nums):
        return None

    values = [num for num in nums if num is not None]
    if len(values) == 1:
        number = values[0]
        if number > 0xFFFFFFFF:
            return None
    elif len(values) == 2:
        first, second = values
        if first > 0xFF or second > 0xFFFFFF:
            return None
        number = (first << 24) | second
    elif len(values) == 3:
        first, second, third = values
        if first > 0xFF or second > 0xFF or third > 0xFFFF:
            return None
        number = (first << 24) | (second << 16) | third
    else:
        first, second, third, fourth = values
        if first > 0xFF or second > 0xFF or third > 0xFF or fourth > 0xFF:
            return None
        number = (first << 24) | (second << 16) | (third << 8) | fourth

    try:
        return ipaddress.IPv4Address(number)
    except ipaddress.AddressValueError:
        return None


# Precomputed once at import — these are on the hot path for
# deny_private_ranges=True (checked for the hostname and each resolved address).
_PRIVATE_IPV4_NETWORKS = (
    ipaddress.IPv4Network("0.0.0.0/8"),
    ipaddress.IPv4Network("10.0.0.0/8"),
    ipaddress.IPv4Network("100.64.0.0/10"),
    ipaddress.IPv4Network("127.0.0.0/8"),
    ipaddress.IPv4Network("169.254.0.0/16"),
    ipaddress.IPv4Network("172.16.0.0/12"),
    ipaddress.IPv4Network("192.0.0.0/24"),
    ipaddress.IPv4Network("192.0.2.0/24"),
    ipaddress.IPv4Network("192.168.0.0/16"),
    ipaddress.IPv4Network("198.18.0.0/15"),
    ipaddress.IPv4Network("198.51.100.0/24"),
    ipaddress.IPv4Network("203.0.113.0/24"),
    ipaddress.IPv4Network("224.0.0.0/4"),
    ipaddress.IPv4Network("240.0.0.0/4"),
)
_PRIVATE_IPV6_NETWORKS = (
    ipaddress.IPv6Network("::/128"),
    ipaddress.IPv6Network("::1/128"),
    ipaddress.IPv6Network("fe80::/10"),
    ipaddress.IPv6Network("fc00::/7"),
    ipaddress.IPv6Network("2001:db8::/32"),
    ipaddress.IPv6Network("64:ff9b::/96"),
    ipaddress.IPv6Network("64:ff9b:1::/48"),
)
_SIXTOFOUR_NETWORK = ipaddress.IPv6Network("2002::/16")


def _is_private_ipv4(ip: ipaddress.IPv4Address) -> bool:
    return any(ip in network for network in _PRIVATE_IPV4_NETWORKS)


def _is_private_ipv6(ip: ipaddress.IPv6Address) -> bool:
    if ip.ipv4_mapped is not None:
        return _is_private_ipv4(ip.ipv4_mapped)
    if any(ip in network for network in _PRIVATE_IPV6_NETWORKS):
        return True
    if ip in _SIXTOFOUR_NETWORK:
        embedded = int(ip) >> 80 & 0xFFFFFFFF
        return _is_private_ipv4(ipaddress.IPv4Address(embedded))
    return False


def _is_private_hostname(hostname: str) -> bool:
    host = hostname.strip().lower()
    if host.startswith("[") and host.endswith("]"):
        host = host[1:-1]
    if host == "localhost" or host.endswith(".localhost"):
        return True
    parsed_ipv4 = _parse_ipv4(host)
    if parsed_ipv4 is not None:
        return _is_private_ipv4(parsed_ipv4)
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    if isinstance(ip, ipaddress.IPv4Address):
        return _is_private_ipv4(ip)
    return _is_private_ipv6(ip)


async def _resolve_host(hostname: str, port: int) -> list[str]:
    """Resolve a hostname to its distinct IP addresses."""
    loop = asyncio.get_running_loop()
    infos = await loop.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
    addresses: list[str] = []
    seen: set[str] = set()
    for *_, sockaddr in infos:
        address = str(sockaddr[0])
        if address in seen:
            continue
        seen.add(address)
        addresses.append(address)
    return addresses


class _PinnedBackend(httpcore.AsyncNetworkBackend):
    """Pin a hostname's TCP connections to a set of pre-vetted IP addresses.

    The addresses are resolved once and checked against the private-range
    denylist up front; pinning the connection to exactly those addresses closes
    the DNS-rebinding TOCTOU window between the allow-list check and connect.
    Non-pinned hosts fall through to the wrapped backend unchanged.
    """

    def __init__(
        self,
        hostname: str,
        addresses: list[str],
        inner: httpcore.AsyncNetworkBackend,
    ) -> None:
        self._hostname = hostname
        self._addresses = addresses
        self._inner = inner

    async def connect_tcp(
        self,
        host: str,
        port: int,
        timeout: float | None = None,
        local_address: str | None = None,
        socket_options: Any = None,
    ) -> httpcore.AsyncNetworkStream:
        if host != self._hostname:
            return await self._inner.connect_tcp(
                host,
                port,
                timeout=timeout,
                local_address=local_address,
                socket_options=socket_options,
            )
        # Connect to a vetted address; the original hostname is still used for
        # the Host header and TLS SNI, so certificate verification is unchanged.
        last_error: Exception | None = None
        for address in self._addresses:
            try:
                return await self._inner.connect_tcp(
                    address,
                    port,
                    timeout=timeout,
                    local_address=local_address,
                    socket_options=socket_options,
                )
            except Exception as exc:  # try the next vetted address
                last_error = exc
        assert last_error is not None
        raise last_error

    async def connect_unix_socket(
        self,
        path: str,
        timeout: float | None = None,
        socket_options: Any = None,
    ) -> httpcore.AsyncNetworkStream:
        return await self._inner.connect_unix_socket(
            path, timeout=timeout, socket_options=socket_options
        )

    async def sleep(self, seconds: float) -> None:
        await self._inner.sleep(seconds)


def _pinned_transport(hostname: str, addresses: list[str]) -> httpx.AsyncHTTPTransport:
    """An httpx transport that pins ``hostname`` to ``addresses`` at connect time."""
    transport = httpx.AsyncHTTPTransport()
    transport._pool._network_backend = _PinnedBackend(
        hostname, addresses, transport._pool._network_backend
    )
    return transport


def _merge_headers(
    user_headers: dict[str, str] | None,
    firewall_headers: dict[str, str],
) -> dict[str, str]:
    merged = dict(user_headers or {})
    for key, value in firewall_headers.items():
        existing = next((k for k in merged if k.lower() == key.lower()), None)
        if existing is not None:
            del merged[existing]
        merged[key] = value
    return merged


def make_default_fetch(config: NetworkConfig):
    """Create an httpx-backed secure fetch function for curl."""

    entries = config.allowed_url_prefixes
    if not config.dangerously_allow_full_internet_access:
        errors = _validate_allow_list(entries)
        if errors:
            raise ValueError("Invalid network allow-list:\n" + "\n".join(errors))

    allowed_methods = (
        ["GET", "HEAD", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
        if config.dangerously_allow_full_internet_access
        else [method.upper() for method in config.allowed_methods]
    )

    async def check_allowed(url: str) -> list[str] | None:
        parsed = _parse_http_url(url)
        if parsed is None:
            raise NetworkAccessDeniedError(url, "invalid URL")

        if not config.dangerously_allow_full_internet_access and not any(
            _matches_allow_entry(url, _entry_url(entry)) for entry in entries
        ):
            raise NetworkAccessDeniedError(url)

        if not config.deny_private_ranges:
            return None

        hostname = parsed.hostname or ""
        if _is_private_hostname(hostname):
            raise NetworkAccessDeniedError(url, "private/loopback IP address blocked")

        port = parsed.port or _default_port(parsed.scheme.lower()) or 80
        addresses = await _resolve_host(hostname, port)
        for address in addresses:
            if _is_private_hostname(address):
                raise NetworkAccessDeniedError(
                    url, "hostname resolves to private/loopback IP address"
                )
        return addresses

    def check_method_allowed(method: str) -> None:
        if config.dangerously_allow_full_internet_access:
            return
        if method.upper() not in allowed_methods:
            raise MethodNotAllowedError(method.upper(), allowed_methods)

    def firewall_headers(url: str) -> dict[str, str]:
        merged: dict[str, str] = {}
        for entry in entries:
            entry_url = _entry_url(entry)
            if isinstance(entry, str) or not _matches_allow_entry(url, entry_url):
                continue
            transforms: Sequence[RequestTransform | dict[str, Any]]
            if isinstance(entry, dict):
                transforms = entry.get("transform", [])
            else:
                transforms = entry.transform
            for transform in transforms:
                headers = (
                    transform.get("headers", {})
                    if isinstance(transform, dict)
                    else transform.headers
                )
                merged.update(headers)
        return merged

    async def fetch(url: str, options: dict[str, Any] | None = None) -> dict[str, Any]:
        options = options or {}
        method = (options.get("method") or "GET").upper()
        check_method_allowed(method)

        current_url = url
        redirect_count = 0
        follow_redirects = options.get("followRedirects", True)
        max_redirects = int(options.get("maxRedirects", config.max_redirects))
        timeout_ms = min(
            int(options.get("timeoutMs") or config.timeout_ms),
            config.timeout_ms,
        )
        body = options.get("body")
        if body is not None and method in {"GET", "HEAD", "OPTIONS"}:
            body = None

        while True:
            pinned_addresses = await check_allowed(current_url)
            transport = (
                _pinned_transport(urlsplit(current_url).hostname or "", pinned_addresses)
                if pinned_addresses
                else None
            )
            timeout = httpx.Timeout(timeout_ms / 1000)
            headers = _merge_headers(
                options.get("headers") or {},
                firewall_headers(current_url),
            )
            try:
                async with httpx.AsyncClient(
                    timeout=timeout,
                    transport=transport,
                    follow_redirects=False,
                ) as client:
                    # Never auto-advertise compression. Real `curl` only sends
                    # Accept-Encoding under --compressed (and then decompresses
                    # itself); httpx otherwise injects `gzip, deflate`, making
                    # servers return raw gzip bytes plain `curl` never asked for.
                    # aiter_raw() in _read_limited_body likewise leaves the body
                    # undecoded so the curl layer controls decompression.
                    client.headers.pop("accept-encoding", None)
                    async with client.stream(
                        method, current_url, headers=headers, content=body
                    ) as resp:
                        if resp.status_code in {301, 302, 303, 307, 308} and follow_redirects:
                            location = resp.headers.get("location")
                            if not location:
                                response_body = await _read_limited_body(
                                    resp, config.max_response_size
                                )
                                return {
                                    "status": resp.status_code,
                                    "statusText": resp.reason_phrase or "",
                                    "headers": {k.lower(): v for k, v in resp.headers.items()},
                                    "body": response_body,
                                    "url": current_url,
                                    "redirectCount": redirect_count,
                                }

                            redirect_url = urljoin(current_url, location)
                            try:
                                await check_allowed(redirect_url)
                            except NetworkAccessDeniedError as exc:
                                raise RedirectNotAllowedError(redirect_url) from exc

                            redirect_count += 1
                            if redirect_count > max_redirects:
                                raise TooManyRedirectsError(max_redirects)

                            current_url = redirect_url
                            continue

                        response_body = await _read_limited_body(resp, config.max_response_size)
                        return {
                            "status": resp.status_code,
                            "statusText": resp.reason_phrase or "",
                            "headers": {k.lower(): v for k, v in resp.headers.items()},
                            "body": response_body,
                            "url": str(resp.url),
                            "redirectCount": redirect_count,
                        }
            except httpx.TimeoutException as exc:
                raise TimeoutError("operation timeout") from exc

    return fetch


async def _read_limited_body(resp: httpx.Response, max_size: int) -> bytes:
    chunks: list[bytes] = []
    total = 0

    if max_size > 0:
        content_length = resp.headers.get("content-length")
        if content_length:
            try:
                size = int(content_length)
            except ValueError:
                size = None
            if size is not None and size > max_size:
                raise ResponseTooLargeError(max_size)

    async for chunk in resp.aiter_raw(_BODY_CHUNK_SIZE):
        total += len(chunk)
        if max_size > 0 and total > max_size:
            raise ResponseTooLargeError(max_size)
        chunks.append(chunk)
    return b"".join(chunks)
