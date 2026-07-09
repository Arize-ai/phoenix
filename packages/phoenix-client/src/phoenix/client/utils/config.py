import logging
import os
from typing import Optional, overload

import httpx

from phoenix.client.constants import (
    ENV_OTEL_EXPORTER_OTLP_ENDPOINT,
    ENV_PHOENIX_API_KEY,
    ENV_PHOENIX_CLIENT_HEADERS,
    ENV_PHOENIX_COLLECTOR_ENDPOINT,
    ENV_PHOENIX_HOST,
    ENV_PHOENIX_HOST_ROOT_PATH,
    ENV_PHOENIX_PORT,
    ENV_PHOENIX_PROJECT,
    ENV_PHOENIX_PROJECT_NAME,
    HOST,
    PORT,
)
from phoenix.client.utils.parse_env_headers import parse_env_headers

logger = logging.getLogger(__name__)


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
    return getenv(ENV_PHOENIX_COLLECTOR_ENDPOINT) or getenv(ENV_OTEL_EXPORTER_OTLP_ENDPOINT)


def get_base_url() -> httpx.URL:
    host: str = get_env_host()
    if host == "0.0.0.0":
        host = "127.0.0.1"
    base_url: str = get_env_collector_endpoint() or f"http://{host}:{get_env_port()}"
    return httpx.URL(base_url)


@overload
def getenv(key: str) -> Optional[str]: ...
@overload
def getenv(key: str, default: str) -> str: ...
def getenv(key: str, default: Optional[str] = None) -> Optional[str]:
    """
    Retrieves the value of an environment variable.

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
    if (value := os.getenv(key)) is None:
        return default
    return value.strip()


_warned_project_conflict = False


def get_env_project_name() -> str:
    """
    Resolve the project name from environment variables.

    Reads both ``PHOENIX_PROJECT_NAME`` (canonical) and ``PHOENIX_PROJECT``
    (supported alias), with ``PHOENIX_PROJECT_NAME`` taking precedence. When both
    are set to different values, the canonical value is used and a one-time
    warning naming both values is emitted.
    """
    global _warned_project_conflict
    canonical = getenv(ENV_PHOENIX_PROJECT_NAME)
    alias = getenv(ENV_PHOENIX_PROJECT)
    if canonical and alias and canonical != alias and not _warned_project_conflict:
        _warned_project_conflict = True
        logger.warning(
            "Both %s (%r) and %s (%r) are set to different values. Using %s (%r). "
            "%s is a supported alias for %s.",
            ENV_PHOENIX_PROJECT_NAME,
            canonical,
            ENV_PHOENIX_PROJECT,
            alias,
            ENV_PHOENIX_PROJECT_NAME,
            canonical,
            ENV_PHOENIX_PROJECT,
            ENV_PHOENIX_PROJECT_NAME,
        )
    return canonical or alias or "default"
