import os
from typing import Optional

from phoenix.client.constants import (
    ENV_PHOENIX_API_KEY,
    ENV_PHOENIX_CLIENT_HEADERS,
    ENV_PHOENIX_COLLECTOR_ENDPOINT,
    ENV_PHOENIX_HOST,
    ENV_PHOENIX_HOST_ROOT_PATH,
    ENV_PHOENIX_PORT,
    HOST,
    PORT,
)
from phoenix.client.utils.parse_env_headers import parse_env_headers


def get_env_phoenix_api_key() -> Optional[str]:
    return os.environ.get(ENV_PHOENIX_API_KEY)


def get_env_port() -> int:
    if not (port := os.getenv(ENV_PHOENIX_PORT)):
        return PORT
    if port.isnumeric():
        return int(port)
    raise ValueError(
        f"Invalid value for environment variable {ENV_PHOENIX_PORT}: "
        f"{port}. Value must be an integer."
    )


def get_env_host() -> str:
    return os.getenv(ENV_PHOENIX_HOST) or HOST


def get_env_host_root_path() -> str:
    if (host_root_path := os.getenv(ENV_PHOENIX_HOST_ROOT_PATH)) is None:
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


def get_env_client_headers() -> Optional[dict[str, str]]:
    if headers_str := os.getenv(ENV_PHOENIX_CLIENT_HEADERS):
        return parse_env_headers(headers_str)
    return None


def get_env_collector_endpoint() -> Optional[str]:
    return os.getenv(ENV_PHOENIX_COLLECTOR_ENDPOINT)


def get_base_url() -> str:
    host = get_env_host()
    if host == "0.0.0.0":
        host = "127.0.0.1"
    base_url = get_env_collector_endpoint() or f"http://{host}:{get_env_port()}"
    return base_url if base_url.endswith("/") else base_url + "/"
