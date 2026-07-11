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
    ENV_PHOENIX_CLIENT_HEADERS,
    ENV_PHOENIX_COLLECTOR_ENDPOINT,
    ENV_PHOENIX_DISCOVER_CONFIG,
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
_SERVER_LOCATION_ENV_KEYS = (
    ENV_PHOENIX_COLLECTOR_ENDPOINT,
    ENV_OTEL_EXPORTER_OTLP_ENDPOINT,
    ENV_PHOENIX_HOST,
    ENV_PHOENIX_PORT,
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
    _warned_invalid_env_file_values.clear()


def _load_process_env_values(keys: Iterable[str]) -> dict[str, str]:
    return {key: value.strip() for key in keys if (value := os.getenv(key)) is not None}


def _resolve_env_tier(keys: Iterable[str]) -> dict[str, str]:
    """Resolve related settings from the process tier, then the file tier."""
    return _resolve_env_tier_with_source(keys)[0]


def _resolve_env_tier_with_source(
    keys: Iterable[str],
) -> tuple[dict[str, str], Optional[_EnvSource]]:
    """Resolve related settings together with the tier that supplied them."""
    keys = tuple(keys)
    if process_values := _load_process_env_values(keys):
        return process_values, _EnvSource("process")
    if not any(key.startswith("PHOENIX_") for key in keys):
        return {}, None
    file_path, file_values = _load_env_file_entry()
    values = {key: file_values[key] for key in keys if key in file_values}
    return values, _EnvSource("env-file", file_path) if values and file_path else None


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


_warned_invalid_env_file_values: set[str] = set()


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
    return _coerce_port(_resolve_env_tier(_SERVER_LOCATION_ENV_KEYS).get(ENV_PHOENIX_PORT))


def get_env_host() -> str:
    return _resolve_env_tier(_SERVER_LOCATION_ENV_KEYS).get(ENV_PHOENIX_HOST) or HOST


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
    values, endpoint_source = _resolve_env_tier_with_source(_SERVER_LOCATION_ENV_KEYS)
    endpoint = values.get(ENV_PHOENIX_COLLECTOR_ENDPOINT) or values.get(
        ENV_OTEL_EXPORTER_OTLP_ENDPOINT
    )
    if endpoint and endpoint_source is not None and endpoint_source.kind == "env-file":
        try:
            httpx.URL(endpoint)
        except httpx.InvalidURL:
            _reject_invalid_env_value(
                ENV_PHOENIX_COLLECTOR_ENDPOINT, endpoint, "Value must be a valid URL."
            )
            return None
    return endpoint


def get_base_url(*, credential_source: Optional[str] = None) -> httpx.URL:
    values, endpoint_source = _resolve_env_tier_with_source(_SERVER_LOCATION_ENV_KEYS)
    endpoint_key: Optional[str] = None
    if endpoint := values.get(ENV_PHOENIX_COLLECTOR_ENDPOINT):
        endpoint_key = ENV_PHOENIX_COLLECTOR_ENDPOINT
    elif endpoint := values.get(ENV_OTEL_EXPORTER_OTLP_ENDPOINT):
        endpoint_key = ENV_OTEL_EXPORTER_OTLP_ENDPOINT
    elif values.get(ENV_PHOENIX_HOST):
        endpoint_key = ENV_PHOENIX_HOST
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
    if endpoint_key is not None:
        _warn_if_using_file_endpoint_with_credentials(
            endpoint_key=endpoint_key,
            endpoint_source=endpoint_source,
            credential_source=credential_source,
        )
    if endpoint:
        if endpoint_source is not None and endpoint_source.kind == "env-file":
            try:
                return httpx.URL(endpoint)
            except httpx.InvalidURL:
                _reject_invalid_env_value(
                    endpoint_key or ENV_PHOENIX_COLLECTOR_ENDPOINT,
                    endpoint,
                    "Value must be a valid URL.",
                )
                endpoint = None
        if endpoint:
            return httpx.URL(endpoint)
    host = values.get(ENV_PHOENIX_HOST) or HOST
    if host == "0.0.0.0":
        host = "127.0.0.1"
    return httpx.URL(f"http://{host}:{_coerce_port(values.get(ENV_PHOENIX_PORT))}")


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
    `default`. A value present in the process environment (even an empty string)
    always wins; the file never overrides anything already set.

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
    if (value := os.getenv(key)) is not None:
        return value.strip()
    if not key.startswith("PHOENIX_"):
        return default
    return _load_env_file_values().get(key, default)


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
