import logging
import os
import re
import stat as stat_module
import urllib.parse
from pathlib import Path
from re import compile
from typing import Dict, List, Optional, Set

logger = logging.getLogger(__name__)

ENV_OTEL_EXPORTER_OTLP_ENDPOINT = "OTEL_EXPORTER_OTLP_ENDPOINT"
ENV_OTEL_EXPORTER_OTLP_HEADERS = "OTEL_EXPORTER_OTLP_HEADERS"

# Phoenix environment variables
ENV_PHOENIX_COLLECTOR_ENDPOINT = "PHOENIX_COLLECTOR_ENDPOINT"
ENV_PHOENIX_GRPC_PORT = "PHOENIX_GRPC_PORT"
# Canonical project-name variable, used in docs.
ENV_PHOENIX_PROJECT = "PHOENIX_PROJECT"
# Supported alias for ``ENV_PHOENIX_PROJECT`` (the name the Python SDKs
# historically read). ``ENV_PHOENIX_PROJECT`` takes precedence when both are set.
ENV_PHOENIX_PROJECT_NAME = "PHOENIX_PROJECT_NAME"
ENV_PHOENIX_CLIENT_HEADERS = "PHOENIX_CLIENT_HEADERS"
ENV_PHOENIX_API_KEY = "PHOENIX_API_KEY"
# Set to "false" (or "0" / "no" / "off") to disable ``.env.phoenix`` file
# discovery. Read from the process environment only.
ENV_PHOENIX_DISCOVER_CONFIG = "PHOENIX_DISCOVER_CONFIG"

PHOENIX_ENV_FILE_NAME = ".env.phoenix"
"""Name of the credential hand-off file discovered at (or above) the working directory."""

GRPC_PORT = 4317
"""The port the gRPC server will run on after launch_app is called.
The default network port for OTLP/gRPC is 4317.
See https://opentelemetry.io/docs/specs/otlp/#otlpgrpc-default-port"""

_ENV_FILE_KEY_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_warned_env_file_permissions: Set[str] = set()


def _is_env_file_discovery_enabled() -> bool:
    """
    Whether ``.env.phoenix`` file discovery is enabled.

    Discovery is on by default and can be disabled by setting
    ``PHOENIX_DISCOVER_CONFIG`` to "false", "0", "no", or "off" (case-insensitive)
    in the process environment. The opt-out is intentionally never read from the
    file itself.
    """
    if (value := os.getenv(ENV_PHOENIX_DISCOVER_CONFIG)) is None:
        return True
    return value.strip().lower() not in ("false", "0", "no", "off")


def _find_env_file(start_dir: Optional[Path] = None) -> Optional[Path]:
    """
    Locate the nearest ``.env.phoenix`` file.

    Walks from ``start_dir`` (defaults to the current working directory) up toward
    the filesystem root and returns the first match, or None if no file is found.
    """
    directory = (start_dir or Path.cwd()).resolve()
    for candidate_dir in (directory, *directory.parents):
        candidate = candidate_dir / PHOENIX_ENV_FILE_NAME
        try:
            stat = candidate.stat()
            is_owned_by_current_user = not hasattr(os, "getuid") or stat.st_uid == os.getuid()
            if stat_module.S_ISREG(stat.st_mode) and is_owned_by_current_user:
                return candidate
        except OSError:
            continue
    return None


def _warn_if_env_file_permissive(path: Path) -> None:
    """
    Emit a one-time warning (per file) if the file is group- or world-readable.

    The file holds credentials, so it should only be readable by its owner. Values
    are never logged. No-op on non-POSIX platforms.
    """
    if os.name != "posix":
        return
    if str(path) in _warned_env_file_permissions:
        return
    try:
        mode = path.stat().st_mode
    except OSError:
        return
    if mode & 0o044:
        _warned_env_file_permissions.add(str(path))
        logger.warning(
            "%s is readable by other users (mode %s). It may contain credentials; "
            "consider restricting its permissions, e.g. `chmod 600 %s`.",
            path,
            oct(mode & 0o777),
            path,
        )


def _parse_env_file(text: str) -> Dict[str, str]:
    """
    Parse dotenv-formatted text, keeping only ``PHOENIX_``-prefixed keys.

    Supports comments (lines starting with ``#``), an optional ``export `` prefix,
    and values wrapped in single or double quotes. Inline comments are not
    stripped. Keys without a ``PHOENIX_`` prefix and empty values are ignored: the
    file is a Phoenix hand-off artifact, not a general dotenv loader.
    """
    values: Dict[str, str] = {}
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :].lstrip()
        key, sep, value = line.partition("=")
        if not sep:
            continue
        key = key.strip()
        if not key.startswith("PHOENIX_") or not _ENV_FILE_KEY_PATTERN.match(key):
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
            value = value[1:-1]
        if value:
            values[key] = value
    return values


def _load_env_file_values() -> Dict[str, str]:
    """
    Load Phoenix settings from the nearest ``.env.phoenix`` file, if any.

    Returns an empty dict when discovery is disabled, no file is found, or the
    file cannot be read.
    """
    if not _is_env_file_discovery_enabled():
        return {}
    if (path := _find_env_file()) is None:
        return {}
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        return {}
    _warn_if_env_file_permissive(path)
    return _parse_env_file(text)


def _getenv(key: str) -> Optional[str]:
    """
    Read a Phoenix setting from the process environment, falling back to the
    nearest ``.env.phoenix`` file.

    A value present in the process environment (even an empty string) always wins;
    the file never overrides anything already set.
    """
    if (value := os.getenv(key)) is not None:
        return value
    return _load_env_file_values().get(key)


def get_env_collector_endpoint() -> Optional[str]:
    """
    Get the collector endpoint from environment variables.

    Checks for Phoenix-specific collector endpoint first, then falls back to the
    standard OpenTelemetry OTLP endpoint environment variable, then to a
    ``PHOENIX_COLLECTOR_ENDPOINT`` entry in the nearest ``.env.phoenix`` file
    (process environment variables always take precedence over the file).

    Returns:
        Optional[str]: The collector endpoint URL if found, None otherwise.
    """
    return (
        os.getenv(ENV_PHOENIX_COLLECTOR_ENDPOINT)
        or os.getenv(ENV_OTEL_EXPORTER_OTLP_ENDPOINT)
        or _load_env_file_values().get(ENV_PHOENIX_COLLECTOR_ENDPOINT)
    )


_warned_project_conflict = False


def get_env_project_name() -> str:
    """
    Get the project name from environment variables.

    Reads both ``PHOENIX_PROJECT`` (canonical) and ``PHOENIX_PROJECT_NAME``
    (supported alias), with ``PHOENIX_PROJECT`` taking precedence. When both
    are set to different values, the canonical value is used and a one-time
    warning naming both values is emitted.

    Returns:
        str: The resolved project name, defaults to "default".
    """
    global _warned_project_conflict
    process_canonical = os.getenv(ENV_PHOENIX_PROJECT)
    process_alias = os.getenv(ENV_PHOENIX_PROJECT_NAME)
    file_values = (
        _load_env_file_values() if process_canonical is None and process_alias is None else {}
    )
    canonical = process_canonical or file_values.get(ENV_PHOENIX_PROJECT)
    alias = process_alias or file_values.get(ENV_PHOENIX_PROJECT_NAME)
    if canonical and alias and canonical != alias and not _warned_project_conflict:
        _warned_project_conflict = True
        logger.warning(
            "Both %s (%r) and %s (%r) are set to different values. Using %s (%r). "
            "%s is a supported alias for %s.",
            ENV_PHOENIX_PROJECT,
            canonical,
            ENV_PHOENIX_PROJECT_NAME,
            alias,
            ENV_PHOENIX_PROJECT,
            canonical,
            ENV_PHOENIX_PROJECT_NAME,
            ENV_PHOENIX_PROJECT,
        )
    return canonical or alias or "default"


def get_env_client_headers() -> Optional[Dict[str, str]]:
    """
    Get client headers from environment variables.

    Parses the PHOENIX_CLIENT_HEADERS environment variable into a dictionary
    of HTTP headers using the W3C Baggage HTTP header format.

    Returns:
        Optional[Dict[str, str]]: Parsed headers dictionary or None if not set.
    """
    if headers_str := os.getenv(ENV_PHOENIX_CLIENT_HEADERS):
        return parse_env_headers(headers_str)
    if os.getenv(ENV_OTEL_EXPORTER_OTLP_HEADERS) is not None:
        return None
    if headers_str := _load_env_file_values().get(ENV_PHOENIX_CLIENT_HEADERS):
        return parse_env_headers(headers_str)
    return None


def get_env_phoenix_auth_header() -> Optional[Dict[str, str]]:
    """
    Get Phoenix authentication header from environment variables.

    Creates an authorization header with Bearer token format using the
    PHOENIX_API_KEY environment variable.

    Returns:
        Optional[Dict[str, str]]: Authorization header dictionary or None if API key not set.
    """
    api_key = os.getenv(ENV_PHOENIX_API_KEY)
    if api_key is None and os.getenv(ENV_OTEL_EXPORTER_OTLP_HEADERS) is not None:
        return None
    if api_key is None:
        api_key = _load_env_file_values().get(ENV_PHOENIX_API_KEY)
    if api_key:
        return dict(authorization=f"Bearer {api_key}")
    else:
        return None


def get_env_grpc_port() -> int:
    """
    Get the gRPC port from environment variables.

    Returns the port number for gRPC connections, with a default of 4317
    (the standard OTLP/gRPC port).

    Returns:
        int: The gRPC port number.

    Raises:
        ValueError: If PHOENIX_GRPC_PORT is set but not a valid integer.
    """
    if not (port := _getenv(ENV_PHOENIX_GRPC_PORT)):
        return GRPC_PORT
    if port.isnumeric():
        return int(port)
    raise ValueError(
        f"Invalid value for environment variable {ENV_PHOENIX_GRPC_PORT}: "
        f"{port}. Value must be an integer."
    )


# Optional whitespace
_OWS = r"[ \t]*"
# A key contains printable US-ASCII characters except: SP and "(),/:;<=>?@[\]{}
_KEY_FORMAT = r"[\x21\x23-\x27\x2a\x2b\x2d\x2e\x30-\x39\x41-\x5a\x5e-\x7a\x7c\x7e]+"
# A value contains a URL-encoded UTF-8 string. The encoded form can contain any
# printable US-ASCII characters (0x20-0x7f) other than SP, DEL, and ",;/
_VALUE_FORMAT = r"[\x21\x23-\x2b\x2d-\x3a\x3c-\x5b\x5d-\x7e]*"
# A key-value is key=value, with optional whitespace surrounding key and value
_KEY_VALUE_FORMAT = rf"{_OWS}{_KEY_FORMAT}{_OWS}={_OWS}{_VALUE_FORMAT}{_OWS}"

_HEADER_PATTERN = compile(_KEY_VALUE_FORMAT)
_DELIMITER_PATTERN = compile(r"[ \t]*,[ \t]*")


def parse_env_headers(s: str) -> Dict[str, str]:
    """
    Parse ``s``, which is a ``str`` instance containing HTTP headers encoded
    for use in ENV variables per the W3C Baggage HTTP header format at
    https://www.w3.org/TR/baggage/#baggage-http-header-format, except that
    additional semi-colon delimited metadata is not supported.

    If the headers are not urlencoded, we will log a warning and attempt to urldecode them.
    """
    headers: Dict[str, str] = {}
    headers_list: List[str] = _DELIMITER_PATTERN.split(s)

    for header in headers_list:
        if not header:  # empty string
            continue

        match = _HEADER_PATTERN.fullmatch(header.strip())
        if not match:
            parts = header.split("=", 1)
            if len(parts) != 2:
                logger.warning(
                    "Header format invalid! Header values in environment variables must be "
                    "URL encoded and in the form name=value."
                )
                continue
            name, value = parts
            encoded_header = f"{urllib.parse.quote(name)}={urllib.parse.quote(value)}"
            match = _HEADER_PATTERN.fullmatch(encoded_header.strip())
            if not match:
                logger.warning(
                    "Header format invalid! Header values in environment variables must be "
                    "URL encoded: %s",
                    f"{name}: ****",
                )
                continue
            logger.warning(
                "Header values in environment variables should be URL encoded, attempting to "
                "URL encode header: {name}: ****"
            )

        name, value = header.split("=", 1)
        name = urllib.parse.unquote(name).strip().lower()
        value = urllib.parse.unquote(value).strip()
        headers[name] = value

    return headers
