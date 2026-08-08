import logging
import os
import re
import stat as stat_module
from pathlib import Path
from typing import Iterable, Literal, NamedTuple, Optional, overload

import httpx

from phoenix.client.constants import (
    ENV_OTEL_EXPORTER_OTLP_ENDPOINT,
    ENV_PHOENIX_API_KEY,
    ENV_PHOENIX_BASE_URL,
    ENV_PHOENIX_CLIENT_HEADERS,
    ENV_PHOENIX_COLLECTOR_ENDPOINT,
    ENV_PHOENIX_DISCOVER_CONFIG,
    ENV_PHOENIX_ENDPOINT,
    ENV_PHOENIX_HOST,
    ENV_PHOENIX_HOST_ROOT_PATH,
    ENV_PHOENIX_PORT,
    ENV_PHOENIX_PROJECT,
    ENV_PHOENIX_PROJECT_NAME,
    HOST,
    PHOENIX_ENV_FILE_NAME,
    PORT,
)
from phoenix.client.utils.parse_env_headers import parse_env_headers

logger = logging.getLogger(__name__)

_ENV_FILE_KEY_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_warned_env_file_permissions: set[str] = set()
_warned_skipped_env_files: set[str] = set()
_warned_cross_tier_endpoints: set[tuple[str, str]] = set()
# Parsed file entries cached per working directory (an empty value map when no
# file exists), so each directory is walked and parsed at most once per process.
# Call clear_env_file_cache() to pick up a file created afterwards.
_env_file_entries_by_dir: dict[str, tuple[Optional[Path], dict[str, str]]] = {}
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
)
# Base-URL candidates for API access, in precedence order: the canonical
# PHOENIX_ENDPOINT first, then the trace-export variables as inferred
# fallbacks, then PHOENIX_BASE_URL, then the legacy PHOENIX_HOST.
_CANONICAL_API_BASE_URL_ENV_KEYS = (ENV_PHOENIX_ENDPOINT,)
_COLLECTOR_ENV_KEYS = (
    ENV_PHOENIX_COLLECTOR_ENDPOINT,
    ENV_OTEL_EXPORTER_OTLP_ENDPOINT,
)
# Undocumented compatibility fallback. PHOENIX_BASE_URL appeared in the client
# docs for years but was never read, so values set from those docs silently did
# nothing. It is honored below the collector variables so those configurations
# start working without retargeting anyone who set both.
_LEGACY_API_BASE_URL_ENV_KEYS = (ENV_PHOENIX_BASE_URL,)
_API_BASE_URL_ENV_KEYS = (
    *_CANONICAL_API_BASE_URL_ENV_KEYS,
    *_COLLECTOR_ENV_KEYS,
    *_LEGACY_API_BASE_URL_ENV_KEYS,
    # Legacy: on the Phoenix server this variable is the bind host, so it is
    # read last and a bare host is turned into a URL with PHOENIX_PORT.
    ENV_PHOENIX_HOST,
)
_SERVER_LOCATION_ENV_KEYS = (
    *_API_BASE_URL_ENV_KEYS,
    ENV_PHOENIX_PORT,
)
# The subset of the group whose presence claims a tier. PHOENIX_BASE_URL is
# excluded: it is a compatibility fallback for a variable no code ever read,
# not a statement about where Phoenix lives, so a stale export of it must not
# suppress a discovered ``.env.phoenix`` that does name the server. It is still
# read — from whichever tier the group claims, or from either tier when no
# claiming variable is set anywhere.
_TIER_CLAIMING_SERVER_LOCATION_ENV_KEYS = tuple(
    key for key in _SERVER_LOCATION_ENV_KEYS if key not in _LEGACY_API_BASE_URL_ENV_KEYS
)
# A collector value may legitimately carry the OTLP path (full-URL exporters
# need it); the API base URL inferred from it must not. Anchored to the end of
# the path so a gateway route *under* /v1/traces is left alone, and applied
# before a query string or fragment so neither is discarded.
_OTLP_TRACES_PATH_PATTERN = re.compile(r"/+v1/traces/?(?=$|[?#])")
_URL_SCHEME_PATTERN = re.compile(r"^https?://", re.IGNORECASE)


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


def _parse_env_file(text: str) -> dict[str, str]:
    """Parse dotenv-formatted text, keeping only non-empty ``PHOENIX_``-prefixed keys."""
    values: dict[str, str] = {}
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


def _load_env_file_entry() -> tuple[Optional[Path], dict[str, str]]:
    """Load the nearest ``.env.phoenix`` values, cached per directory (misses included)."""
    if not _is_env_file_discovery_enabled():
        return None, {}
    try:
        start_dir = Path.cwd()
    except OSError:
        return None, {}
    if (cached := _env_file_entries_by_dir.get(str(start_dir))) is not None:
        return cached
    values: dict[str, str] = {}
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


def _load_env_file_values() -> dict[str, str]:
    return _load_env_file_entry()[1]


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
    _warned_invalid_env_values.clear()


def _normalize_env_value(value: Optional[str]) -> Optional[str]:
    """Trim a value; one that is empty after trimming counts as unset.

    Applied at every read boundary so that ``export PHOENIX_ENDPOINT=`` behaves
    like a variable that was never exported, instead of pinning resolution to a
    value nothing can use.
    """
    if value is None:
        return None
    return value.strip() or None


def _load_process_env_values(keys: Iterable[str]) -> dict[str, str]:
    return {key: value for key in keys if (value := _normalize_env_value(os.getenv(key)))}


def _load_env_file_values_for(keys: Iterable[str]) -> tuple[Optional[Path], dict[str, str]]:
    file_path, file_values = _load_env_file_entry()
    return file_path, {
        key: value for key in keys if (value := _normalize_env_value(file_values.get(key)))
    }


def _resolve_env_tier(keys: Iterable[str]) -> dict[str, str]:
    """Resolve related settings from the process tier, then the file tier."""
    return _resolve_env_tier_with_source(keys)[0]


def _resolve_env_tier_with_source(
    keys: Iterable[str],
    *,
    tier_claiming_keys: Optional[Iterable[str]] = None,
) -> tuple[dict[str, str], Optional[_EnvSource]]:
    """Resolve related settings together with the tier that supplied them.

    ``tier_claiming_keys`` narrows which of ``keys`` decide the tier. A key
    outside that subset is read from whichever tier the group claims, and
    resolves on its own (process first) only when no claiming key is set in
    either tier.
    """
    keys = tuple(keys)
    claiming_keys = tuple(tier_claiming_keys) if tier_claiming_keys is not None else keys
    process_values = _load_process_env_values(keys)
    if any(key in process_values for key in claiming_keys):
        return process_values, _EnvSource("process")
    if not any(key.startswith("PHOENIX_") for key in keys):
        return {}, None
    file_path, values = _load_env_file_values_for(keys)
    if not any(key in values for key in claiming_keys) and process_values:
        return process_values, _EnvSource("process")
    return values, _EnvSource("env-file", file_path) if values and file_path else None


def _resolve_server_location_values() -> tuple[dict[str, str], Optional[_EnvSource]]:
    """Resolve the variables that locate the Phoenix server, as one tier group."""
    return _resolve_env_tier_with_source(
        _SERVER_LOCATION_ENV_KEYS,
        tier_claiming_keys=_TIER_CLAIMING_SERVER_LOCATION_ENV_KEYS,
    )


def _file_canonical_override(
    source: Optional[_EnvSource], canonical_keys: Iterable[str]
) -> tuple[Optional[str], Optional[str], Optional[_EnvSource]]:
    """The cross-tier exception to whole-group tier resolution: a process value
    merely inferred from a sibling variable must not mask the concept's
    canonical variable declared in a discovered ``.env.phoenix``. Returns the
    (key, value, source) of the file-tier canonical value when that exception
    applies.
    """
    if source is None or source.kind != "process":
        return None, None, None
    canonical_keys = tuple(canonical_keys)
    file_path, file_values = _load_env_file_values_for(canonical_keys)
    for key in canonical_keys:
        if value := file_values.get(key):
            return key, value, _EnvSource("env-file", file_path)
    return None, None, None


def _warn_if_using_file_endpoint_with_credentials(
    *,
    endpoint_key: str,
    endpoint_source: Optional[_EnvSource],
    credential_source: Optional[str],
) -> None:
    if (
        not credential_source
        or endpoint_source is None
        or endpoint_source.kind != "env-file"
        or endpoint_source.file_path is None
    ):
        return
    warning_key = str(endpoint_source.file_path), endpoint_key
    if warning_key in _warned_cross_tier_endpoints:
        return
    _warned_cross_tier_endpoints.add(warning_key)
    logger.warning(
        "Credentials from %s will be sent to %s set by %s.",
        credential_source,
        endpoint_key,
        endpoint_source.file_path,
    )


_warned_invalid_env_values: set[str] = set()


def _warn_invalid_env_value(env_key: str, value: str, message: str, *, from_env_file: bool) -> None:
    """Warn once per variable that its value is unusable and is being ignored."""
    if env_key in _warned_invalid_env_values:
        return
    _warned_invalid_env_values.add(env_key)
    if from_env_file:
        logger.warning(
            "Ignoring invalid %s value from a discovered %s file: %s. %s",
            env_key,
            PHOENIX_ENV_FILE_NAME,
            value,
            message,
        )
    else:
        logger.warning(
            "Ignoring invalid %s value from the process environment: %s. %s",
            env_key,
            value,
            message,
        )


def _reject_invalid_env_value(env_key: str, value: str, message: str) -> None:
    """Raise for an invalid process-env value; warn once and ignore an env-file value."""
    if _normalize_env_value(os.getenv(env_key)) is not None:
        raise ValueError(f"Invalid value for environment variable {env_key}: {value}. {message}")
    _warn_invalid_env_value(env_key, value, message, from_env_file=True)


def _coerce_port(port: Optional[str]) -> int:
    if not port:
        return PORT
    if port.isnumeric():
        return int(port)
    _reject_invalid_env_value(ENV_PHOENIX_PORT, port, "Value must be an integer.")
    return PORT


def get_env_phoenix_api_key() -> Optional[str]:
    values = _resolve_env_tier(_CREDENTIAL_ENV_KEYS)
    return values.get(ENV_PHOENIX_API_KEY)


def get_env_port() -> int:
    return _coerce_port(_resolve_server_location_values()[0].get(ENV_PHOENIX_PORT))


def get_env_host() -> str:
    return _resolve_server_location_values()[0].get(ENV_PHOENIX_HOST) or HOST


def get_env_host_root_path() -> str:
    if (host_root_path := getenv(ENV_PHOENIX_HOST_ROOT_PATH)) is None:
        return ""
    if not host_root_path.startswith("/"):
        _reject_invalid_env_value(
            ENV_PHOENIX_HOST_ROOT_PATH, host_root_path, "Value must start with '/'"
        )
        return ""
    if host_root_path.endswith("/"):
        _reject_invalid_env_value(
            ENV_PHOENIX_HOST_ROOT_PATH, host_root_path, "Value cannot end with '/'"
        )
        return ""
    return host_root_path


def get_env_client_headers() -> dict[str, str]:
    values = _resolve_env_tier(_CREDENTIAL_ENV_KEYS)
    headers = parse_env_headers(values.get(ENV_PHOENIX_CLIENT_HEADERS))
    if (api_key := values.get(ENV_PHOENIX_API_KEY)) and "authorization" not in [
        k.lower() for k in headers
    ]:
        headers["Authorization"] = f"Bearer {api_key}"
    return headers


def get_env_collector_endpoint() -> Optional[str]:
    values, endpoint_source = _resolve_server_location_values()
    endpoint_key = next((key for key in _COLLECTOR_ENV_KEYS if key in values), None)
    endpoint = values.get(endpoint_key) if endpoint_key else None
    if not endpoint:
        file_key, file_endpoint, file_source = _file_canonical_override(
            endpoint_source, (ENV_PHOENIX_COLLECTOR_ENDPOINT,)
        )
        if file_endpoint:
            endpoint_key, endpoint, endpoint_source = file_key, file_endpoint, file_source
    # Inference deliberately does not run in this direction: trace export reads
    # only the collector variables, matching arize-phoenix-otel. API consumers
    # fall back to PHOENIX_COLLECTOR_ENDPOINT instead, so one value configures
    # both without the two SDKs disagreeing about where spans go.
    if endpoint and endpoint_source is not None and endpoint_source.kind == "env-file":
        try:
            httpx.URL(endpoint)
        except httpx.InvalidURL:
            _reject_invalid_env_value(
                endpoint_key or ENV_PHOENIX_COLLECTOR_ENDPOINT,
                endpoint,
                "Value must be a valid URL.",
            )
            return None
    return endpoint


def _normalize_base_url_candidate(env_key: str, value: str, port: Optional[str]) -> str:
    """Turn a variable's raw value into an API base URL, per that variable's shape."""
    if env_key in _COLLECTOR_ENV_KEYS:
        return _OTLP_TRACES_PATH_PATTERN.sub("", value) or value
    if env_key == ENV_PHOENIX_HOST and not _URL_SCHEME_PATTERN.match(value):
        # PHOENIX_HOST is the server's bind host, so a bare host becomes a URL
        # on PHOENIX_PORT; a value that already carries a port is taken as-is.
        host = "127.0.0.1" if value == "0.0.0.0" else value
        return f"http://{host}" if ":" in host else f"http://{host}:{_coerce_port(port)}"
    return value


def _parse_base_url_candidate(
    env_key: str, value: str, source: Optional[_EnvSource]
) -> Optional[httpx.URL]:
    """Parse a resolved candidate, warning and yielding to the next one if it is unusable."""
    try:
        return httpx.URL(value)
    except httpx.InvalidURL:
        _warn_invalid_env_value(
            env_key,
            value,
            "Value must be a valid URL. Falling back to the next configured variable.",
            from_env_file=source is not None and source.kind == "env-file",
        )
        return None


def get_base_url(*, credential_source: Optional[str] = None) -> httpx.URL:
    values, endpoint_source = _resolve_server_location_values()
    candidates = [
        (key, values[key], endpoint_source) for key in _API_BASE_URL_ENV_KEYS if key in values
    ]
    if not candidates or candidates[0][0] not in _CANONICAL_API_BASE_URL_ENV_KEYS:
        file_key, file_endpoint, file_source = _file_canonical_override(
            endpoint_source, _CANONICAL_API_BASE_URL_ENV_KEYS
        )
        if file_key and file_endpoint:
            candidates.insert(0, (file_key, file_endpoint, file_source))
    if credential_source is None:
        credential_values, resolved_credential_source = _resolve_env_tier_with_source(
            _CREDENTIAL_ENV_KEYS
        )
        if (
            credential_values
            and resolved_credential_source is not None
            and resolved_credential_source.kind == "process"
        ):
            credential_source = "the process environment"
    port = values.get(ENV_PHOENIX_PORT)
    for endpoint_key, endpoint, candidate_source in candidates:
        candidate = _normalize_base_url_candidate(endpoint_key, endpoint, port)
        # A variable whose value cannot be a URL must not strand resolution: a
        # lower-ranked variable may still name a reachable server.
        if (
            base_url := _parse_base_url_candidate(endpoint_key, candidate, candidate_source)
        ) is None:
            continue
        _warn_if_using_file_endpoint_with_credentials(
            endpoint_key=endpoint_key,
            endpoint_source=candidate_source,
            credential_source=credential_source,
        )
        return base_url
    return httpx.URL(_normalize_base_url_candidate(ENV_PHOENIX_HOST, HOST, port))


@overload
def getenv(key: str) -> Optional[str]: ...
@overload
def getenv(key: str, default: str) -> str: ...
def getenv(key: str, default: Optional[str] = None) -> Optional[str]:
    """
    Retrieves the value of an environment variable.

    When the variable is not set in the process environment and the key is
    ``PHOENIX_``-prefixed, the nearest ``.env.phoenix`` file (discovered by walking
    up from the current working directory) is consulted before falling back to
    `default`. A value present in the process environment always wins; the file
    never overrides anything already set. A value that is empty after trimming
    counts as unset.

    Parameters
    ----------
        key : str
            The name of the environment variable.
        default : Optional[str], optional
            The default value to return if the environment variable is not set, by default None.

    Returns
    -------
    Optional[str]
        The value of the environment variable, or `default` if the variable is not set.
        Leading and trailing whitespaces are stripped from the value, assuming they were
        inadvertently added.
    """
    if (value := _normalize_env_value(os.getenv(key))) is not None:
        return value
    if not key.startswith("PHOENIX_"):
        return default
    return _normalize_env_value(_load_env_file_values().get(key)) or default


_warned_project_conflict = False


def get_env_project_name() -> str:
    """
    Resolve the project name from environment variables.

    Reads both ``PHOENIX_PROJECT`` (canonical) and ``PHOENIX_PROJECT_NAME``
    (supported alias), with ``PHOENIX_PROJECT`` taking precedence. When both
    are set to different values, the canonical value is used and a one-time
    warning naming both values is emitted.
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
