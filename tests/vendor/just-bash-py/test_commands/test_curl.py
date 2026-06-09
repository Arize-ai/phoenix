"""Tests for curl command improvements.

These tests cover:
- Cookie file loading (-b @file)
- --max-redirs enforcement
- Extended write-out variables
- --compressed flag
"""

import gzip
import zlib
import pytest
from just_bash.commands.curl.curl import CurlCommand, parse_options, CurlOptions
from just_bash.types import CommandContext
from just_bash.fs import InMemoryFs


class TestCurlCookieFile:
    """Tests for cookie file loading with -b @file."""

    @pytest.mark.asyncio
    async def test_curl_cookie_from_file(self):
        """Reading cookies from a file with -b @file."""
        fs = InMemoryFs()
        await fs.write_file("/cookies.txt", "session=abc123; token=xyz789")

        request_headers = {}

        async def mock_fetch(url, options):
            request_headers.update(options.get("headers", {}))
            return {
                "status": 200,
                "statusText": "OK",
                "headers": {"content-type": "text/plain"},
                "body": "OK",
                "url": url,
            }

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="", fetch=mock_fetch)
        cmd = CurlCommand()
        result = await cmd.execute(["-b", "@/cookies.txt", "https://example.com"], ctx)

        assert result.exit_code == 0
        assert request_headers.get("Cookie") == "session=abc123; token=xyz789"

    @pytest.mark.asyncio
    async def test_curl_cookie_inline_preserved(self):
        """Inline cookie syntax still works (not @prefixed)."""
        fs = InMemoryFs()

        request_headers = {}

        async def mock_fetch(url, options):
            request_headers.update(options.get("headers", {}))
            return {
                "status": 200,
                "statusText": "OK",
                "headers": {"content-type": "text/plain"},
                "body": "OK",
                "url": url,
            }

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="", fetch=mock_fetch)
        cmd = CurlCommand()
        result = await cmd.execute(["-b", "session=inline", "https://example.com"], ctx)

        assert result.exit_code == 0
        assert request_headers.get("Cookie") == "session=inline"

    @pytest.mark.asyncio
    async def test_curl_cookie_file_not_found(self):
        """Error when cookie file doesn't exist."""
        fs = InMemoryFs()

        async def mock_fetch(url, options):
            return {
                "status": 200,
                "statusText": "OK",
                "headers": {},
                "body": "OK",
                "url": url,
            }

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="", fetch=mock_fetch)
        cmd = CurlCommand()
        result = await cmd.execute(["-b", "@/nonexistent.txt", "https://example.com"], ctx)

        assert result.exit_code != 0
        assert "No such file" in result.stderr or "not found" in result.stderr.lower()


class TestCurlMaxRedirs:
    """Tests for --max-redirs enforcement."""

    @pytest.mark.asyncio
    async def test_curl_max_redirs_parsing(self):
        """--max-redirs value is parsed correctly."""
        opts = parse_options(["--max-redirs", "5", "https://example.com"])
        assert isinstance(opts, CurlOptions)
        assert opts.max_redirects == 5

        opts2 = parse_options(["--max-redirs=10", "https://example.com"])
        assert isinstance(opts2, CurlOptions)
        assert opts2.max_redirects == 10

    @pytest.mark.asyncio
    async def test_curl_max_redirs_passed_to_fetch(self):
        """--max-redirs value is passed to fetch function."""
        fs = InMemoryFs()
        fetch_options = {}

        async def mock_fetch(url, options):
            fetch_options.update(options)
            return {
                "status": 200,
                "statusText": "OK",
                "headers": {},
                "body": "OK",
                "url": url,
            }

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="", fetch=mock_fetch)
        cmd = CurlCommand()
        result = await cmd.execute(["--max-redirs", "3", "https://example.com"], ctx)

        assert result.exit_code == 0
        assert fetch_options.get("maxRedirects") == 3

    @pytest.mark.asyncio
    async def test_curl_max_redirs_zero_disables_redirects(self):
        """--max-redirs=0 disables redirect following."""
        fs = InMemoryFs()
        fetch_options = {}

        async def mock_fetch(url, options):
            fetch_options.update(options)
            return {
                "status": 200,
                "statusText": "OK",
                "headers": {},
                "body": "OK",
                "url": url,
            }

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="", fetch=mock_fetch)
        cmd = CurlCommand()
        result = await cmd.execute(["--max-redirs=0", "https://example.com"], ctx)

        assert result.exit_code == 0
        assert fetch_options.get("maxRedirects") == 0


class TestCurlWriteOutExtended:
    """Tests for extended write-out variables."""

    @pytest.mark.asyncio
    async def test_curl_write_out_response_code(self):
        """%{response_code} is alias for %{http_code}."""
        fs = InMemoryFs()

        async def mock_fetch(url, options):
            return {
                "status": 201,
                "statusText": "Created",
                "headers": {},
                "body": "",
                "url": url,
            }

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="", fetch=mock_fetch)
        cmd = CurlCommand()
        result = await cmd.execute(
            ["-w", "%{response_code}", "-s", "https://example.com"], ctx
        )

        assert result.exit_code == 0
        assert "201" in result.stdout

    @pytest.mark.asyncio
    async def test_curl_write_out_num_redirects(self):
        """%{num_redirects} shows redirect count."""
        fs = InMemoryFs()

        async def mock_fetch(url, options):
            return {
                "status": 200,
                "statusText": "OK",
                "headers": {},
                "body": "",
                "url": url,
                "redirectCount": 2,
            }

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="", fetch=mock_fetch)
        cmd = CurlCommand()
        result = await cmd.execute(
            ["-w", "%{num_redirects}", "-s", "https://example.com"], ctx
        )

        assert result.exit_code == 0
        assert "2" in result.stdout

    @pytest.mark.asyncio
    async def test_curl_write_out_redirect_url(self):
        """%{redirect_url} shows final URL after redirects."""
        fs = InMemoryFs()

        async def mock_fetch(url, options):
            return {
                "status": 200,
                "statusText": "OK",
                "headers": {},
                "body": "",
                "url": "https://example.com/final",
            }

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="", fetch=mock_fetch)
        cmd = CurlCommand()
        result = await cmd.execute(
            ["-w", "%{redirect_url}", "-s", "https://example.com"], ctx
        )

        assert result.exit_code == 0
        assert "https://example.com/final" in result.stdout

    @pytest.mark.asyncio
    async def test_curl_write_out_header_size(self):
        """%{header_size} shows response header size."""
        fs = InMemoryFs()

        async def mock_fetch(url, options):
            return {
                "status": 200,
                "statusText": "OK",
                "headers": {"content-type": "text/plain", "x-custom": "value"},
                "body": "data",
                "url": url,
            }

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="", fetch=mock_fetch)
        cmd = CurlCommand()
        result = await cmd.execute(
            ["-w", "%{header_size}", "-s", "https://example.com"], ctx
        )

        assert result.exit_code == 0
        # Header size should be > 0
        size = int(result.stdout.strip().replace("data", ""))
        assert size > 0

    @pytest.mark.asyncio
    async def test_curl_write_out_time_total(self):
        """%{time_total} shows total request time."""
        fs = InMemoryFs()

        async def mock_fetch(url, options):
            return {
                "status": 200,
                "statusText": "OK",
                "headers": {},
                "body": "",
                "url": url,
            }

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="", fetch=mock_fetch)
        cmd = CurlCommand()
        result = await cmd.execute(
            ["-w", "%{time_total}", "-s", "https://example.com"], ctx
        )

        assert result.exit_code == 0
        # Time should be a number >= 0
        time_str = result.stdout.strip()
        time_val = float(time_str)
        assert time_val >= 0

    @pytest.mark.asyncio
    async def test_curl_write_out_speed_download(self):
        """%{speed_download} shows download speed in bytes/sec."""
        fs = InMemoryFs()

        async def mock_fetch(url, options):
            return {
                "status": 200,
                "statusText": "OK",
                "headers": {},
                "body": "x" * 1000,
                "url": url,
            }

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="", fetch=mock_fetch)
        cmd = CurlCommand()
        result = await cmd.execute(
            ["-w", "%{speed_download}", "-s", "https://example.com"], ctx
        )

        assert result.exit_code == 0
        # Speed should be a number >= 0
        body_and_speed = result.stdout
        # Remove the body to get speed
        speed_str = body_and_speed.replace("x" * 1000, "").strip()
        speed_val = float(speed_str)
        assert speed_val >= 0


class TestCurlCompressed:
    """Tests for --compressed flag."""

    @pytest.mark.asyncio
    async def test_curl_compressed_sets_header(self):
        """--compressed sets Accept-Encoding header."""
        fs = InMemoryFs()
        request_headers = {}

        async def mock_fetch(url, options):
            request_headers.update(options.get("headers", {}))
            return {
                "status": 200,
                "statusText": "OK",
                "headers": {},
                "body": "data",
                "url": url,
            }

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="", fetch=mock_fetch)
        cmd = CurlCommand()
        result = await cmd.execute(["--compressed", "https://example.com"], ctx)

        assert result.exit_code == 0
        assert "Accept-Encoding" in request_headers
        assert "gzip" in request_headers["Accept-Encoding"]
        assert "deflate" in request_headers["Accept-Encoding"]

    @pytest.mark.asyncio
    async def test_curl_compressed_gzip_decompression(self):
        """--compressed decompresses gzip response."""
        fs = InMemoryFs()
        original_data = "Hello, compressed world!"
        compressed_data = gzip.compress(original_data.encode())

        async def mock_fetch(url, options):
            return {
                "status": 200,
                "statusText": "OK",
                "headers": {"content-encoding": "gzip"},
                "body": compressed_data,
                "url": url,
                "bodyIsBytes": True,
            }

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="", fetch=mock_fetch)
        cmd = CurlCommand()
        result = await cmd.execute(["--compressed", "-s", "https://example.com"], ctx)

        assert result.exit_code == 0
        assert original_data in result.stdout

    @pytest.mark.asyncio
    async def test_curl_compressed_deflate_decompression(self):
        """--compressed decompresses deflate response."""
        fs = InMemoryFs()
        original_data = "Hello, deflate world!"
        compressed_data = zlib.compress(original_data.encode())

        async def mock_fetch(url, options):
            return {
                "status": 200,
                "statusText": "OK",
                "headers": {"content-encoding": "deflate"},
                "body": compressed_data,
                "url": url,
                "bodyIsBytes": True,
            }

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="", fetch=mock_fetch)
        cmd = CurlCommand()
        result = await cmd.execute(["--compressed", "-s", "https://example.com"], ctx)

        assert result.exit_code == 0
        assert original_data in result.stdout

    @pytest.mark.asyncio
    async def test_curl_compressed_parsing(self):
        """--compressed flag is parsed correctly."""
        opts = parse_options(["--compressed", "https://example.com"])
        assert isinstance(opts, CurlOptions)
        assert opts.compressed is True

        opts2 = parse_options(["https://example.com"])
        assert isinstance(opts2, CurlOptions)
        assert opts2.compressed is False
