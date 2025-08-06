from __future__ import annotations

import logging
import os
from re import compile, split
from typing import Optional, overload
from urllib.parse import unquote

import opentelemetry.sdk.trace as trace_sdk
from opentelemetry import trace as trace_api
from opentelemetry.trace import NoOpTracer, Tracer

logger = logging.getLogger(__name__)

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


ENV_PHOENIX_PORT = "PHOENIX_PORT"
ENV_PHOENIX_GRPC_PORT = "PHOENIX_GRPC_PORT"
ENV_PHOENIX_HOST = "PHOENIX_HOST"
ENV_PHOENIX_HOST_ROOT_PATH = "PHOENIX_HOST_ROOT_PATH"
ENV_PHOENIX_COLLECTOR_ENDPOINT = "PHOENIX_COLLECTOR_ENDPOINT"
ENV_PHOENIX_CLIENT_HEADERS = "PHOENIX_CLIENT_HEADERS"
ENV_PHOENIX_API_KEY = "PHOENIX_API_KEY"
ENV_OTEL_EXPORTER_OTLP_ENDPOINT = "OTEL_EXPORTER_OTLP_ENDPOINT"

HOST = "0.0.0.0"
PORT = 6006


def parse_env_headers(s: Optional[str]) -> dict[str, str]:
    """
    Parse ``s``, which is a ``str`` instance containing HTTP headers encoded
    for use in ENV variables per the W3C Baggage HTTP header format at
    https://www.w3.org/TR/baggage/#baggage-http-header-format, except that
    additional semicolon delimited metadata is not supported.

    src: https://github.com/open-telemetry/opentelemetry-python/blob/2d5cd58f33bd8a16f45f30be620a96699bc14297/opentelemetry-api/src/opentelemetry/util/re.py#L52
    """
    headers: dict[str, str] = {}
    if not s:
        return headers
    headers_list: list[str] = split(_DELIMITER_PATTERN, s)
    for header in headers_list:
        if not header:  # empty string
            continue
        match = _HEADER_PATTERN.fullmatch(header.strip())
        if not match:
            logger.warning(
                "Header format invalid! Header values in environment variables must be "
                "URL encoded: %s",
                header,
            )
            continue
        # value may contain any number of `=`
        name, value = match.string.split("=", 1)
        name = unquote(name).strip().lower()
        value = unquote(value).strip()
        headers[name] = value
    return headers


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


def get_base_url() -> str:
    host: str = get_env_host()
    if host == "0.0.0.0":
        host = "127.0.0.1"
    base_url: str = get_env_collector_endpoint() or f"http://{host}:{get_env_port()}"
    return base_url


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


def get_tracer(tracer_provider: Optional[trace_sdk.TracerProvider] = None) -> Tracer:
    """
    1. Use the provided tracer_provider if given
    2. Otherwise, pull from the global tracer provider
    3. Fall back to NoOpTracer if all else fails

    Args:
        tracer_provider: Optional tracer provider to use. If None, will use global provider.

    Returns:
        A tracer instance
    """
    try:
        if tracer_provider is not None:
            return tracer_provider.get_tracer(__name__)

        global_tracer_provider = trace_api.get_tracer_provider()
        return global_tracer_provider.get_tracer(__name__)

    except Exception:
        logger.debug("Failed to get tracer, falling back to NoOpTracer")
        return NoOpTracer()
