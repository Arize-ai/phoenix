"""Curl command implementation."""

import base64
import gzip
import time
import zlib
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urlencode, urlparse, quote

from ...types import CommandContext, ExecResult


@dataclass
class FormField:
    """A form field for multipart data."""
    name: str
    value: str
    filename: Optional[str] = None
    content_type: Optional[str] = None


@dataclass
class CurlOptions:
    """Parsed curl options."""
    method: str = "GET"
    headers: dict[str, str] = field(default_factory=dict)
    data: Optional[str] = None
    data_binary: bool = False
    form_fields: list[FormField] = field(default_factory=list)
    user: Optional[str] = None
    upload_file: Optional[str] = None
    cookie_jar: Optional[str] = None
    cookie_file: Optional[str] = None  # -b @file
    output_file: Optional[str] = None
    use_remote_name: bool = False
    head_only: bool = False
    include_headers: bool = False
    silent: bool = False
    show_error: bool = False
    fail_silently: bool = False
    follow_redirects: bool = True
    max_redirects: Optional[int] = None  # --max-redirs
    compressed: bool = False  # --compressed
    write_out: Optional[str] = None
    verbose: bool = False
    timeout_ms: Optional[int] = None
    url: Optional[str] = None


def encode_form_data(input_str: str) -> str:
    """URL-encode form data in curl's --data-urlencode format."""
    eq_index = input_str.find("=")
    if eq_index >= 0:
        name = input_str[:eq_index]
        value = input_str[eq_index + 1:]
        if name:
            return f"{quote(name, safe='')}={quote(value, safe='')}"
        return quote(value, safe='')
    return quote(input_str, safe='')


def parse_form_field(spec: str) -> Optional[FormField]:
    """Parse -F/--form field specification."""
    eq_index = spec.find("=")
    if eq_index < 0:
        return None

    name = spec[:eq_index]
    value = spec[eq_index + 1:]
    filename = None
    content_type = None

    # Check for ;type= suffix
    if ";type=" in value:
        type_idx = value.rfind(";type=")
        content_type = value[type_idx + 6:]
        value = value[:type_idx]

    # Check for ;filename= suffix
    if ";filename=" in value:
        fn_idx = value.find(";filename=")
        fn_end = value.find(";", fn_idx + 1)
        if fn_end < 0:
            fn_end = len(value)
        filename = value[fn_idx + 10:fn_end]
        value = value[:fn_idx] + (value[fn_end:] if fn_end < len(value) else "")

    # @ means file upload, < means file content
    if value.startswith("@") or value.startswith("<"):
        if not filename:
            filename = value[1:].split("/")[-1]

    return FormField(name=name, value=value, filename=filename, content_type=content_type)


def generate_multipart_body(
    fields: list[FormField],
    file_contents: dict[str, str],
) -> tuple[str, str]:
    """Generate multipart form data body and boundary."""
    boundary = f"----CurlFormBoundary{int(time.time() * 1000):x}"
    parts = []

    for field in fields:
        value = field.value

        # Replace file references with content
        if value.startswith("@") or value.startswith("<"):
            file_path = value[1:]
            value = file_contents.get(file_path, "")

        part = f"--{boundary}\r\n"
        if field.filename:
            part += f'Content-Disposition: form-data; name="{field.name}"; filename="{field.filename}"\r\n'
            if field.content_type:
                part += f"Content-Type: {field.content_type}\r\n"
        else:
            part += f'Content-Disposition: form-data; name="{field.name}"\r\n'
        part += f"\r\n{value}\r\n"
        parts.append(part)

    parts.append(f"--{boundary}--\r\n")
    return "".join(parts), boundary


def format_headers(headers: dict[str, str]) -> str:
    """Format response headers for output."""
    return "\r\n".join(f"{name}: {value}" for name, value in headers.items())


def body_to_stdout(body: str | bytes) -> str:
    """Convert response bytes to stdout's string representation."""
    if isinstance(body, bytes):
        return body.decode("latin-1")
    return body


def extract_filename(url: str) -> str:
    """Extract filename from URL for -O option."""
    try:
        parsed = urlparse(url)
        pathname = parsed.path
        filename = pathname.split("/")[-1] if pathname else ""
        return filename or "index.html"
    except Exception:
        return "index.html"


def apply_write_out(format_str: str, result: dict) -> str:
    """Apply write-out format string replacements."""
    output = format_str
    status = str(result.get("status", 0))
    headers = result.get("headers", {})

    # Basic variables
    output = output.replace("%{http_code}", status)
    output = output.replace("%{response_code}", status)  # Alias for http_code
    output = output.replace("%{content_type}", headers.get("content-type", ""))
    output = output.replace("%{url_effective}", result.get("url", ""))
    output = output.replace("%{size_download}", str(result.get("body_length", 0)))

    # Redirect variables
    output = output.replace("%{num_redirects}", str(result.get("redirect_count", 0)))
    output = output.replace("%{redirect_url}", result.get("url", ""))

    # Header size (calculated from formatted headers)
    header_size = result.get("header_size", 0)
    output = output.replace("%{header_size}", str(header_size))

    # Timing variables
    time_total = result.get("time_total", 0.0)
    output = output.replace("%{time_total}", f"{time_total:.6f}")

    # Speed (bytes/sec)
    speed_download = result.get("speed_download", 0.0)
    output = output.replace("%{speed_download}", f"{speed_download:.3f}")

    output = output.replace("\\n", "\n")
    return output


def parse_options(args: list[str]) -> CurlOptions | ExecResult:
    """Parse curl command line arguments."""
    options = CurlOptions()
    i = 0

    while i < len(args):
        arg = args[i]

        if arg == "-X" or arg == "--request":
            i += 1
            options.method = args[i] if i < len(args) else "GET"
        elif arg.startswith("-X"):
            options.method = arg[2:]
        elif arg.startswith("--request="):
            options.method = arg[10:]

        elif arg == "-H" or arg == "--header":
            i += 1
            if i < len(args):
                header = args[i]
                colon_idx = header.find(":")
                if colon_idx > 0:
                    name = header[:colon_idx].strip()
                    value = header[colon_idx + 1:].strip()
                    options.headers[name] = value
        elif arg.startswith("--header="):
            header = arg[9:]
            colon_idx = header.find(":")
            if colon_idx > 0:
                name = header[:colon_idx].strip()
                value = header[colon_idx + 1:].strip()
                options.headers[name] = value

        elif arg == "-d" or arg == "--data" or arg == "--data-raw":
            i += 1
            options.data = args[i] if i < len(args) else ""
            if options.method == "GET":
                options.method = "POST"
        elif arg.startswith("-d"):
            options.data = arg[2:]
            if options.method == "GET":
                options.method = "POST"
        elif arg.startswith("--data="):
            options.data = arg[7:]
            if options.method == "GET":
                options.method = "POST"
        elif arg.startswith("--data-raw="):
            options.data = arg[11:]
            if options.method == "GET":
                options.method = "POST"

        elif arg == "--data-binary":
            i += 1
            options.data = args[i] if i < len(args) else ""
            options.data_binary = True
            if options.method == "GET":
                options.method = "POST"
        elif arg.startswith("--data-binary="):
            options.data = arg[14:]
            options.data_binary = True
            if options.method == "GET":
                options.method = "POST"

        elif arg == "--data-urlencode":
            i += 1
            value = args[i] if i < len(args) else ""
            encoded = encode_form_data(value)
            if options.data:
                options.data = f"{options.data}&{encoded}"
            else:
                options.data = encoded
            if options.method == "GET":
                options.method = "POST"
        elif arg.startswith("--data-urlencode="):
            value = arg[17:]
            encoded = encode_form_data(value)
            if options.data:
                options.data = f"{options.data}&{encoded}"
            else:
                options.data = encoded
            if options.method == "GET":
                options.method = "POST"

        elif arg == "-F" or arg == "--form":
            i += 1
            if i < len(args):
                form_field = parse_form_field(args[i])
                if form_field:
                    options.form_fields.append(form_field)
            if options.method == "GET":
                options.method = "POST"
        elif arg.startswith("--form="):
            form_field = parse_form_field(arg[7:])
            if form_field:
                options.form_fields.append(form_field)
            if options.method == "GET":
                options.method = "POST"

        elif arg == "-u" or arg == "--user":
            i += 1
            options.user = args[i] if i < len(args) else None
        elif arg.startswith("-u"):
            options.user = arg[2:]
        elif arg.startswith("--user="):
            options.user = arg[7:]

        elif arg == "-A" or arg == "--user-agent":
            i += 1
            options.headers["User-Agent"] = args[i] if i < len(args) else ""
        elif arg.startswith("-A"):
            options.headers["User-Agent"] = arg[2:]
        elif arg.startswith("--user-agent="):
            options.headers["User-Agent"] = arg[13:]

        elif arg == "-e" or arg == "--referer":
            i += 1
            options.headers["Referer"] = args[i] if i < len(args) else ""
        elif arg.startswith("-e"):
            options.headers["Referer"] = arg[2:]
        elif arg.startswith("--referer="):
            options.headers["Referer"] = arg[10:]

        elif arg == "-b" or arg == "--cookie":
            i += 1
            cookie_value = args[i] if i < len(args) else ""
            if cookie_value.startswith("@"):
                options.cookie_file = cookie_value[1:]  # Store file path without @
            else:
                options.headers["Cookie"] = cookie_value
        elif arg.startswith("-b"):
            cookie_value = arg[2:]
            if cookie_value.startswith("@"):
                options.cookie_file = cookie_value[1:]
            else:
                options.headers["Cookie"] = cookie_value
        elif arg.startswith("--cookie="):
            cookie_value = arg[9:]
            if cookie_value.startswith("@"):
                options.cookie_file = cookie_value[1:]
            else:
                options.headers["Cookie"] = cookie_value

        elif arg == "-c" or arg == "--cookie-jar":
            i += 1
            options.cookie_jar = args[i] if i < len(args) else None
        elif arg.startswith("--cookie-jar="):
            options.cookie_jar = arg[13:]

        elif arg == "-T" or arg == "--upload-file":
            i += 1
            options.upload_file = args[i] if i < len(args) else None
            if options.method == "GET":
                options.method = "PUT"
        elif arg.startswith("--upload-file="):
            options.upload_file = arg[14:]
            if options.method == "GET":
                options.method = "PUT"

        elif arg == "-m" or arg == "--max-time":
            i += 1
            try:
                secs = float(args[i] if i < len(args) else "0")
                if secs > 0:
                    options.timeout_ms = int(secs * 1000)
            except ValueError:
                pass
        elif arg.startswith("--max-time="):
            try:
                secs = float(arg[11:])
                if secs > 0:
                    options.timeout_ms = int(secs * 1000)
            except ValueError:
                pass

        elif arg == "--connect-timeout":
            i += 1
            try:
                secs = float(args[i] if i < len(args) else "0")
                if secs > 0 and options.timeout_ms is None:
                    options.timeout_ms = int(secs * 1000)
            except ValueError:
                pass
        elif arg.startswith("--connect-timeout="):
            try:
                secs = float(arg[18:])
                if secs > 0 and options.timeout_ms is None:
                    options.timeout_ms = int(secs * 1000)
            except ValueError:
                pass

        elif arg == "-o" or arg == "--output":
            i += 1
            options.output_file = args[i] if i < len(args) else None
        elif arg.startswith("--output="):
            options.output_file = arg[9:]

        elif arg == "-O" or arg == "--remote-name":
            options.use_remote_name = True

        elif arg == "-I" or arg == "--head":
            options.head_only = True
            options.method = "HEAD"

        elif arg == "-i" or arg == "--include":
            options.include_headers = True

        elif arg == "-s" or arg == "--silent":
            options.silent = True

        elif arg == "-S" or arg == "--show-error":
            options.show_error = True

        elif arg == "-f" or arg == "--fail":
            options.fail_silently = True

        elif arg == "-L" or arg == "--location":
            options.follow_redirects = True

        elif arg == "--max-redirs":
            i += 1
            try:
                options.max_redirects = int(args[i]) if i < len(args) else None
            except ValueError:
                pass

        elif arg.startswith("--max-redirs="):
            try:
                options.max_redirects = int(arg[13:])
            except ValueError:
                pass

        elif arg == "-w" or arg == "--write-out":
            i += 1
            options.write_out = args[i] if i < len(args) else None
        elif arg.startswith("--write-out="):
            options.write_out = arg[12:]

        elif arg == "-v" or arg == "--verbose":
            options.verbose = True

        elif arg == "--compressed":
            options.compressed = True

        elif arg.startswith("--") and arg != "--":
            return ExecResult(
                stdout="",
                stderr=f"curl: option {arg}: is unknown\n",
                exit_code=2,
            )
        elif arg.startswith("-") and arg != "-":
            # Handle combined short options like -sS
            for c in arg[1:]:
                if c == "s":
                    options.silent = True
                elif c == "S":
                    options.show_error = True
                elif c == "f":
                    options.fail_silently = True
                elif c == "L":
                    options.follow_redirects = True
                elif c == "I":
                    options.head_only = True
                    options.method = "HEAD"
                elif c == "i":
                    options.include_headers = True
                elif c == "O":
                    options.use_remote_name = True
                elif c == "v":
                    options.verbose = True
                else:
                    return ExecResult(
                        stdout="",
                        stderr=f"curl: option -{c}: is unknown\n",
                        exit_code=2,
                    )
        elif not arg.startswith("-"):
            options.url = arg

        i += 1

    return options


class CurlCommand:
    """The curl command - transfer a URL."""

    name = "curl"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the curl command."""
        if "--help" in args:
            return ExecResult(
                stdout=(
                    "Usage: curl [OPTIONS] URL\n"
                    "Transfer a URL.\n\n"
                    "Options:\n"
                    "  -X, --request METHOD  HTTP method (GET, POST, PUT, DELETE, etc.)\n"
                    "  -H, --header HEADER   Add header (can be used multiple times)\n"
                    "  -d, --data DATA       HTTP POST data\n"
                    "      --data-raw DATA   HTTP POST data (no @ interpretation)\n"
                    "      --data-binary DATA  HTTP POST binary data\n"
                    "      --data-urlencode DATA  URL-encode and POST data\n"
                    "  -F, --form NAME=VALUE  Multipart form data\n"
                    "  -u, --user USER:PASS  HTTP authentication\n"
                    "  -A, --user-agent STR  Set User-Agent header\n"
                    "  -e, --referer URL     Set Referer header\n"
                    "  -b, --cookie DATA     Send cookies (name=value or @file)\n"
                    "  -c, --cookie-jar FILE Save cookies to file\n"
                    "  -T, --upload-file FILE  Upload file (PUT)\n"
                    "  -o, --output FILE     Write output to file\n"
                    "  -O, --remote-name     Write to file named from URL\n"
                    "  -I, --head            Show headers only (HEAD request)\n"
                    "  -i, --include         Include response headers in output\n"
                    "  -s, --silent          Silent mode (no progress)\n"
                    "  -S, --show-error      Show errors even when silent\n"
                    "  -f, --fail            Fail silently on HTTP errors (no output)\n"
                    "  -L, --location        Follow redirects (default)\n"
                    "      --max-redirs NUM  Maximum redirects (default: 20)\n"
                    "  -m, --max-time SECS   Maximum time for request\n"
                    "      --connect-timeout SECS  Connection timeout\n"
                    "  -w, --write-out FMT   Output format after completion\n"
                    "  -v, --verbose         Verbose output\n"
                    "      --help            Display this help and exit\n"
                ),
                stderr="",
                exit_code=0,
            )

        # Parse options
        result = parse_options(args)
        if isinstance(result, ExecResult):
            return result

        options = result

        # Check for URL
        if not options.url:
            return ExecResult(
                stdout="",
                stderr="curl: no URL specified\n",
                exit_code=2,
            )

        # Check for fetch function
        if not ctx.fetch:
            return ExecResult(
                stdout="",
                stderr="curl: internal error: fetch not available\n",
                exit_code=1,
            )

        # Normalize URL
        url = options.url
        if not url.startswith("http://") and not url.startswith("https://"):
            url = f"https://{url}"

        try:
            # Load cookies from file if specified
            if options.cookie_file:
                cookie_path = ctx.fs.resolve_path(ctx.cwd, options.cookie_file)
                try:
                    cookie_content = await ctx.fs.read_file(cookie_path)
                    options.headers["Cookie"] = cookie_content.strip()
                except Exception:
                    return ExecResult(
                        stdout="",
                        stderr=f"curl: (26) Failed to open/read cookie file: {options.cookie_file}: No such file or directory\n",
                        exit_code=26,
                    )

            # Prepare body and headers
            body, content_type = await self._prepare_request_body(options, ctx)
            headers = self._prepare_headers(options, content_type)

            # Add Accept-Encoding header if --compressed
            if options.compressed and "Accept-Encoding" not in headers:
                headers["Accept-Encoding"] = "gzip, deflate"

            # Track timing for write-out variables
            start_time = time.time()

            # Make the request
            fetch_options = {
                "method": options.method,
                "headers": headers if headers else None,
                "body": body,
                "followRedirects": options.follow_redirects,
                "timeoutMs": options.timeout_ms,
            }
            if options.max_redirects is not None:
                fetch_options["maxRedirects"] = options.max_redirects

            result = await ctx.fetch(url, fetch_options)

            # Calculate timing
            elapsed_time = time.time() - start_time

            # Decompress response if --compressed and Content-Encoding is set
            response_headers = result.get("headers", {})
            content_encoding = response_headers.get("content-encoding", "").lower()
            body = result.get("body", "")

            if options.compressed and content_encoding:
                body = self._decompress_body(body, content_encoding)
                result["body"] = body

            # Save cookies if requested
            await self._save_cookies(options, response_headers, ctx)

            # Check for HTTP errors with -f/--fail
            status = result.get("status", 0)
            if options.fail_silently and status >= 400:
                stderr = ""
                if options.show_error or not options.silent:
                    stderr = f"curl: (22) The requested URL returned error: {status}\n"
                return ExecResult(stdout="", stderr=stderr, exit_code=22)

            # Calculate header size (approximate)
            header_size = len(format_headers(response_headers)) + 20  # +20 for status line

            # Calculate download speed (bytes/sec)
            body_length = len(body) if isinstance(body, str) else len(body)
            speed_download = body_length / elapsed_time if elapsed_time > 0 else 0.0

            # Prepare write-out data
            write_out_data = {
                "status": status,
                "headers": response_headers,
                "url": result.get("url", url),
                "body_length": body_length,
                "redirect_count": result.get("redirectCount", 0),
                "header_size": header_size,
                "time_total": elapsed_time,
                "speed_download": speed_download,
            }

            output = self._build_output(options, result, url, write_out_data)

            # Write to file
            if options.output_file or options.use_remote_name:
                filename = options.output_file or extract_filename(url)
                file_path = ctx.fs.resolve_path(ctx.cwd, filename)
                body_content = "" if options.head_only else result.get("body", "")
                await ctx.fs.write_file(file_path, body_content)

                # When writing to file, don't output body unless verbose
                if not options.verbose:
                    output = ""

                # Add write-out after file write
                if options.write_out:
                    output = apply_write_out(options.write_out, write_out_data)

            return ExecResult(stdout=output, stderr="", exit_code=0)

        except Exception as e:
            message = str(e)

            # Determine exit code based on error type
            exit_code = 1
            if "Network access denied" in message:
                exit_code = 7  # CURLE_COULDNT_CONNECT
            elif "HTTP method" in message and "not allowed" in message:
                exit_code = 3  # CURLE_URL_MALFORMAT-like
            elif "Redirect target not in allow-list" in message:
                exit_code = 47  # CURLE_TOO_MANY_REDIRECTS-like
            elif "Too many redirects" in message:
                exit_code = 47
            elif "aborted" in message or "timeout" in message.lower():
                exit_code = 28  # CURLE_OPERATION_TIMEDOUT

            # Silent mode suppresses error output unless -S is used
            show_err = not options.silent or options.show_error
            stderr = f"curl: ({exit_code}) {message}\n" if show_err else ""

            return ExecResult(stdout="", stderr=stderr, exit_code=exit_code)

    async def _prepare_request_body(
        self,
        options: CurlOptions,
        ctx: CommandContext,
    ) -> tuple[Optional[str], Optional[str]]:
        """Prepare request body from options."""
        # Handle -T/--upload-file
        if options.upload_file:
            file_path = ctx.fs.resolve_path(ctx.cwd, options.upload_file)
            content = await ctx.fs.read_file(file_path)
            return content, None

        # Handle -F/--form multipart data
        if options.form_fields:
            file_contents = {}

            # Read any file references
            for field in options.form_fields:
                if field.value.startswith("@") or field.value.startswith("<"):
                    file_path = ctx.fs.resolve_path(ctx.cwd, field.value[1:])
                    try:
                        content = await ctx.fs.read_file(file_path)
                        file_contents[field.value[1:]] = content
                    except Exception:
                        file_contents[field.value[1:]] = ""

            body, boundary = generate_multipart_body(options.form_fields, file_contents)
            return body, f"multipart/form-data; boundary={boundary}"

        # Handle -d/--data variants
        if options.data is not None:
            return options.data, None

        return None, None

    def _prepare_headers(
        self,
        options: CurlOptions,
        content_type: Optional[str],
    ) -> dict[str, str]:
        """Prepare request headers from options."""
        headers = dict(options.headers)

        # Add authentication header
        if options.user:
            encoded = base64.b64encode(options.user.encode()).decode()
            headers["Authorization"] = f"Basic {encoded}"

        # Set content type if needed and not already set
        if content_type and "Content-Type" not in headers:
            headers["Content-Type"] = content_type

        return headers

    async def _save_cookies(
        self,
        options: CurlOptions,
        headers: dict[str, str],
        ctx: CommandContext,
    ) -> None:
        """Save cookies from response to cookie jar file."""
        if not options.cookie_jar:
            return

        set_cookie = headers.get("set-cookie")
        if not set_cookie:
            return

        file_path = ctx.fs.resolve_path(ctx.cwd, options.cookie_jar)
        await ctx.fs.write_file(file_path, set_cookie)

    def _decompress_body(self, body: str | bytes, encoding: str) -> str:
        """Decompress response body based on Content-Encoding."""
        try:
            # Handle bytes or string input
            if isinstance(body, str):
                body_bytes = body.encode("latin-1")
            else:
                body_bytes = body

            if encoding == "gzip":
                decompressed = gzip.decompress(body_bytes)
            elif encoding == "deflate":
                decompressed = zlib.decompress(body_bytes)
            else:
                return body if isinstance(body, str) else body.decode("utf-8", errors="replace")

            return decompressed.decode("utf-8", errors="replace")
        except Exception:
            # If decompression fails, return original body
            return body if isinstance(body, str) else body.decode("utf-8", errors="replace")

    def _build_output(
        self,
        options: CurlOptions,
        result: dict,
        request_url: str,
        write_out_data: dict | None = None,
    ) -> str:
        """Build output string from response."""
        output = ""
        status = result.get("status", 0)
        status_text = result.get("statusText", "")
        headers = result.get("headers", {})
        body = result.get("body", "")
        url = result.get("url", request_url)

        # Verbose output
        if options.verbose:
            output += f"> {options.method} {request_url}\n"
            for name, value in options.headers.items():
                output += f"> {name}: {value}\n"
            output += ">\n"
            output += f"< HTTP/1.1 {status} {status_text}\n"
            for name, value in headers.items():
                output += f"< {name}: {value}\n"
            output += "<\n"

        # Include headers with -i/--include
        if options.include_headers and not options.verbose:
            output += f"HTTP/1.1 {status} {status_text}\r\n"
            output += format_headers(headers)
            output += "\r\n\r\n"

        # Add body (unless head-only mode)
        if not options.head_only:
            output += body_to_stdout(body)
        elif options.include_headers or options.verbose:
            # For HEAD, we already showed headers
            pass
        else:
            # HEAD without -i shows headers
            output += f"HTTP/1.1 {status} {status_text}\r\n"
            output += format_headers(headers)
            output += "\r\n"

        # Write-out format
        if options.write_out:
            # Use provided write_out_data if available, otherwise build basic data
            if write_out_data is None:
                write_out_data = {
                    "status": status,
                    "headers": headers,
                    "url": url,
                    "body_length": len(body),
                }
            output += apply_write_out(options.write_out, write_out_data)

        return output
