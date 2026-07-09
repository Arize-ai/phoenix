import logging
import os
import re
import stat as stat_module
from pathlib import Path
from typing import Optional, overload

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


def _parse_env_file(text: str) -> dict[str, str]:
    """
    Parse dotenv-formatted text, keeping only ``PHOENIX_``-prefixed keys.

    Supports comments (lines starting with ``#``), an optional ``export `` prefix,
    and values wrapped in single or double quotes. Inline comments are not
    stripped. Keys without a ``PHOENIX_`` prefix and empty values are ignored: the
    file is a Phoenix hand-off artifact, not a general dotenv loader.
    """
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


def _load_env_file_values() -> dict[str, str]:
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


def get_env_phoenix_api_key() -> Optional[str]:
    return getenv(ENV_PHOENIX_API_KEY)


def get_env_port() -> int:
    if not (port := getenv(ENV_PHOENIX_PORT)):
        return PORT
    if port.isnumeric():
        return int(port)
    raise ValueError(
        f"Invalid value for environment variable {ENV_PHOENIX_PORT}: "
        f"{port}. Value must be an integer."
    )


def get_env_host() -> str:
    return getenv(ENV_PHOENIX_HOST) or HOST


def get_env_host_root_path() -> str:
    if (host_root_path := getenv(ENV_PHOENIX_HOST_ROOT_PATH)) is None:
        return ""
    if not host_root_path.startswith("/"):
        raise ValueError(
            f"Invalid value for environment variable {ENV_PHOENIX_HOST_ROOT_PATH}: "
            f"{host_root_path}. Value must start with '/'"
        )
    if host_root_path.endswith("/"):
        raise ValueError(
            f"Invalid value for environment variable {ENV_PHOENIX_HOST_ROOT_PATH}: "
            f"{host_root_path}. Value cannot end with '/'"
        )
    return host_root_path


def get_env_client_headers() -> dict[str, str]:
    headers = parse_env_headers(getenv(ENV_PHOENIX_CLIENT_HEADERS))
    if (api_key := get_env_phoenix_api_key()) and "authorization" not in [
        k.lower() for k in headers
    ]:
        headers["Authorization"] = f"Bearer {api_key}"
    return headers


def get_env_collector_endpoint() -> Optional[str]:
    # Both process environment variables take precedence over the .env.phoenix
    # file, so the standard OTLP variable is checked before the file fallback.
    if endpoint := (os.getenv(ENV_PHOENIX_COLLECTOR_ENDPOINT) or "").strip():
        return endpoint
    if endpoint := (os.getenv(ENV_OTEL_EXPORTER_OTLP_ENDPOINT) or "").strip():
        return endpoint
    return _load_env_file_values().get(ENV_PHOENIX_COLLECTOR_ENDPOINT)


def get_base_url() -> httpx.URL:
    host: str = get_env_host()
    if host == "0.0.0.0":
        host = "127.0.0.1"
    process_endpoint = os.getenv(ENV_PHOENIX_COLLECTOR_ENDPOINT) or os.getenv(
        ENV_OTEL_EXPORTER_OTLP_ENDPOINT
    )
    has_process_host_config = any(
        os.getenv(key) is not None for key in (ENV_PHOENIX_HOST, ENV_PHOENIX_PORT)
    )
    file_endpoint = (
        None
        if has_process_host_config
        else _load_env_file_values().get(ENV_PHOENIX_COLLECTOR_ENDPOINT)
    )
    base_url: str = process_endpoint or file_endpoint or f"http://{host}:{get_env_port()}"
    return httpx.URL(base_url)


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
    if key.startswith("PHOENIX_") and (file_value := _load_env_file_values().get(key)) is not None:
        return file_value
    return default


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
