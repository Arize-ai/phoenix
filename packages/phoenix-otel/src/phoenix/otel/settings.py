import logging
import os
import stat as stat_module
import urllib.parse
from pathlib import Path
from re import compile
from typing import Dict, Iterable, List, Literal, NamedTuple, Optional, Set, Tuple

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

_ENV_FILE_KEY_PATTERN = compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_warned_env_file_permissions: Set[str] = set()
_warned_invalid_env_file_values: Set[str] = set()
_warned_skipped_env_files: Set[str] = set()
_warned_cross_tier_endpoints: Set[Tuple[str, str]] = set()
# Parsed file entries cached per working directory (an empty value map when no
# file exists), so each directory is walked and parsed at most once per process.
# Call clear_env_file_cache() to pick up a file created afterwards.
_env_file_entries_by_dir: Dict[str, Tuple[Optional[Path], Dict[str, str]]] = {}
_MAX_ENV_FILE_SIZE_BYTES = 64 * 1024


class _EnvSource(NamedTuple):
    kind: Literal["process", "env-file"]
    file_path: Optional[Path] = None


# Related settings resolved as one tier group: when any key of a group is set
# in the process environment, the ``.env.phoenix`` file tier is ignored for the
# whole group, so process and file values are never mixed within a group.
_CREDENTIAL_ENV_KEYS = (
    ENV_PHOENIX_API_KEY,
    ENV_PHOENIX_CLIENT_HEADERS,
    ENV_OTEL_EXPORTER_OTLP_HEADERS,
)
_SERVER_LOCATION_ENV_KEYS = (
    ENV_PHOENIX_COLLECTOR_ENDPOINT,
    ENV_OTEL_EXPORTER_OTLP_ENDPOINT,
    ENV_PHOENIX_GRPC_PORT,
)


def _is_env_file_discovery_enabled() -> bool:
    """Whether ``.env.phoenix`` discovery is enabled; the opt-out is process-env only."""
    if (value := os.getenv(ENV_PHOENIX_DISCOVER_CONFIG)) is None:
        return True
    return value.strip().lower() not in ("false", "0", "no", "off")


def _is_trusted_env_file_stat(stat: os.stat_result) -> bool:
    """Whether the stat describes a regular file owned by the current user."""
    is_owned_by_current_user = not hasattr(os, "getuid") or stat.st_uid == os.getuid()
    return stat_module.S_ISREG(stat.st_mode) and is_owned_by_current_user


def _find_env_file(start_dir: Path) -> Optional[Path]:
    """Locate the nearest ``.env.phoenix`` file, walking up from ``start_dir``."""
    for candidate_dir in (start_dir, *start_dir.parents):
        candidate = candidate_dir / PHOENIX_ENV_FILE_NAME
        try:
            stat = candidate.stat()
            if _is_trusted_env_file_stat(stat):
                return candidate
            _warn_if_env_file_skipped(
                candidate, "file must be a regular file owned by the current user"
            )
        except FileNotFoundError:
            continue
        except OSError:
            _warn_if_env_file_skipped(candidate, "file could not be inspected")
    return None


def _warn_if_env_file_skipped(path: Path, reason: str) -> None:
    if str(path) in _warned_skipped_env_files:
        return
    _warned_skipped_env_files.add(str(path))
    logger.warning("Ignoring %s: %s.", path, reason)


def _warn_if_env_file_permissive(path: Path, mode: int) -> None:
    """Warn once per file if it is accessible by other users; no-op on non-POSIX."""
    if os.name != "posix":
        return
    if str(path) in _warned_env_file_permissions:
        return
    if mode & 0o066:
        _warned_env_file_permissions.add(str(path))
        logger.warning(
            "%s is accessible by other users (mode %s). It may contain credentials; "
            "consider restricting its permissions, e.g. `chmod 600 %s`.",
            path,
            oct(mode & 0o777),
            path,
        )


def _parse_env_file(text: str) -> Dict[str, str]:
    """Parse dotenv-formatted text, keeping only non-empty ``PHOENIX_``-prefixed keys."""
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


def _load_env_file_entry() -> Tuple[Optional[Path], Dict[str, str]]:
    """Load the nearest ``.env.phoenix`` values, cached per directory (misses included)."""
    if not _is_env_file_discovery_enabled():
        return None, {}
    try:
        start_dir = Path.cwd()
    except OSError:
        return None, {}
    if (cached := _env_file_entries_by_dir.get(str(start_dir))) is not None:
        return cached
    values: Dict[str, str] = {}
    path = _find_env_file(start_dir)
    if path is not None:
        try:
            with open(path, "rb") as env_file:
                # Re-check trust on the opened descriptor, not the pre-open path.
                stat = os.fstat(env_file.fileno())
                if _is_trusted_env_file_stat(stat):
                    if stat.st_size > _MAX_ENV_FILE_SIZE_BYTES:
                        _warn_if_env_file_skipped(
                            path, f"file exceeds {_MAX_ENV_FILE_SIZE_BYTES} bytes"
                        )
                    else:
                        _warn_if_env_file_permissive(path, stat.st_mode)
                        contents = env_file.read(_MAX_ENV_FILE_SIZE_BYTES + 1)
                        if len(contents) > _MAX_ENV_FILE_SIZE_BYTES:
                            _warn_if_env_file_skipped(
                                path, f"file exceeds {_MAX_ENV_FILE_SIZE_BYTES} bytes"
                            )
                        else:
                            values = _parse_env_file(contents.decode("utf-8"))
                else:
                    _warn_if_env_file_skipped(
                        path, "opened file must be a regular file owned by the current user"
                    )
        except (OSError, UnicodeError):
            _warn_if_env_file_skipped(path, "file could not be read")
    entry = path, values
    _env_file_entries_by_dir[str(start_dir)] = entry
    return entry


def clear_env_file_cache() -> None:
    """
    Clear cached ``.env.phoenix`` discovery results.

    Discovery results (including the absence of a file) are cached per working
    directory for the lifetime of the process. Long-running processes (e.g.
    notebooks) that create or change a ``.env.phoenix`` file after the first
    configuration lookup can call this to make subsequent lookups re-discover
    the file.
    """
    _env_file_entries_by_dir.clear()
    _warned_env_file_permissions.clear()
    _warned_skipped_env_files.clear()
    _warned_cross_tier_endpoints.clear()
    _warned_invalid_env_file_values.clear()


def _load_process_env_values(keys: Iterable[str]) -> Dict[str, str]:
    return {key: value.strip() for key in keys if (value := os.getenv(key)) is not None}


def _resolve_env_tier(keys: Iterable[str]) -> Dict[str, str]:
    """Resolve related settings from the process tier, then the file tier."""
    return _resolve_env_tier_with_source(keys)[0]


def _resolve_env_tier_with_source(
    keys: Iterable[str],
) -> Tuple[Dict[str, str], Optional[_EnvSource]]:
    """Resolve related settings together with the tier that supplied them."""
    keys = tuple(keys)
    if process_values := _load_process_env_values(keys):
        return process_values, _EnvSource("process")
    if not any(key.startswith("PHOENIX_") for key in keys):
        return {}, None
    file_path, file_values = _load_env_file_entry()
    values = {key: file_values[key] for key in keys if key in file_values}
    return values, _EnvSource("env-file", file_path) if values and file_path else None


def warn_if_using_file_endpoint_with_credentials(*, credential_source: Optional[str]) -> None:
    values, endpoint_source = _resolve_env_tier_with_source(_SERVER_LOCATION_ENV_KEYS)
    if not values.get(ENV_PHOENIX_COLLECTOR_ENDPOINT):
        return
    if (
        not credential_source
        or endpoint_source is None
        or endpoint_source.kind != "env-file"
        or endpoint_source.file_path is None
    ):
        return
    warning_key = str(endpoint_source.file_path), ENV_PHOENIX_COLLECTOR_ENDPOINT
    if warning_key in _warned_cross_tier_endpoints:
        return
    _warned_cross_tier_endpoints.add(warning_key)
    logger.warning(
        "Credentials from %s will be sent to %s set by %s.",
        credential_source,
        ENV_PHOENIX_COLLECTOR_ENDPOINT,
        endpoint_source.file_path,
    )


def _reject_invalid_env_value(env_key: str, value: str, message: str) -> None:
    """Raise for an invalid process-env value; warn once and ignore an env-file value."""
    if os.getenv(env_key) is not None:
        raise ValueError(f"Invalid value for environment variable {env_key}: {value}. {message}")
    if env_key not in _warned_invalid_env_file_values:
        _warned_invalid_env_file_values.add(env_key)
        logger.warning(
            "Ignoring invalid %s value from a discovered %s file: %s. %s",
            env_key,
            PHOENIX_ENV_FILE_NAME,
            value,
            message,
        )


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
    values, endpoint_source = _resolve_env_tier_with_source(_SERVER_LOCATION_ENV_KEYS)
    credential_values, credential_source = _resolve_env_tier_with_source(_CREDENTIAL_ENV_KEYS)
    if credential_values and credential_source is not None and credential_source.kind == "process":
        warn_if_using_file_endpoint_with_credentials(credential_source="the process environment")
    endpoint = values.get(ENV_PHOENIX_COLLECTOR_ENDPOINT) or values.get(
        ENV_OTEL_EXPORTER_OTLP_ENDPOINT
    )
    if endpoint and endpoint_source is not None and endpoint_source.kind == "env-file":
        try:
            parsed_endpoint = urllib.parse.urlparse(endpoint)
            if parsed_endpoint.scheme not in ("http", "https") or parsed_endpoint.hostname is None:
                raise ValueError("URL must include an HTTP(S) scheme and hostname")
            _ = parsed_endpoint.port
        except ValueError:
            _reject_invalid_env_value(
                ENV_PHOENIX_COLLECTOR_ENDPOINT, endpoint, "Value must be a valid URL."
            )
            return None
    return endpoint


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
    values = _resolve_env_tier((ENV_PHOENIX_PROJECT, ENV_PHOENIX_PROJECT_NAME))
    canonical = values.get(ENV_PHOENIX_PROJECT)
    alias = values.get(ENV_PHOENIX_PROJECT_NAME)
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
    values = _resolve_env_tier(_CREDENTIAL_ENV_KEYS)
    if headers_str := values.get(ENV_PHOENIX_CLIENT_HEADERS):
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
    values = _resolve_env_tier(_CREDENTIAL_ENV_KEYS)
    api_key = values.get(ENV_PHOENIX_API_KEY)
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
        ValueError: If PHOENIX_GRPC_PORT is set in the process environment but
            is not a valid integer. An invalid value that only came from a
            discovered ``.env.phoenix`` file is ignored with a warning instead.
    """
    if not (port := _resolve_env_tier(_SERVER_LOCATION_ENV_KEYS).get(ENV_PHOENIX_GRPC_PORT)):
        return GRPC_PORT
    if port.isnumeric():
        return int(port)
    _reject_invalid_env_value(ENV_PHOENIX_GRPC_PORT, port, "Value must be an integer.")
    return GRPC_PORT


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
