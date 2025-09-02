import logging
import os
import urllib
from re import compile
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

ENV_OTEL_EXPORTER_OTLP_ENDPOINT = "OTEL_EXPORTER_OTLP_ENDPOINT"

# Phoenix environment variables
ENV_PHOENIX_COLLECTOR_ENDPOINT = "PHOENIX_COLLECTOR_ENDPOINT"
ENV_PHOENIX_GRPC_PORT = "PHOENIX_GRPC_PORT"
ENV_PHOENIX_PROJECT_NAME = "PHOENIX_PROJECT_NAME"
ENV_PHOENIX_CLIENT_HEADERS = "PHOENIX_CLIENT_HEADERS"
ENV_PHOENIX_API_KEY = "PHOENIX_API_KEY"

GRPC_PORT = 4317
"""The port the gRPC server will run on after launch_app is called.
The default network port for OTLP/gRPC is 4317.
See https://opentelemetry.io/docs/specs/otlp/#otlpgrpc-default-port"""


def get_env_collector_endpoint() -> Optional[str]:
    """
    Get the collector endpoint from environment variables.

    Checks for Phoenix-specific collector endpoint first, then falls back to the
    standard OpenTelemetry OTLP endpoint environment variable.

    Returns:
        Optional[str]: The collector endpoint URL if found, None otherwise.
    """
    return os.getenv(ENV_PHOENIX_COLLECTOR_ENDPOINT) or os.getenv(ENV_OTEL_EXPORTER_OTLP_ENDPOINT)


def get_env_project_name() -> str:
    """
    Get the project name from environment variables.

    Returns:
        str: The project name from PHOENIX_PROJECT_NAME, defaults to "default".
    """
    return os.getenv(ENV_PHOENIX_PROJECT_NAME, "default")


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
    return None


def get_env_phoenix_auth_header() -> Optional[Dict[str, str]]:
    """
    Get Phoenix authentication header from environment variables.

    Creates an authorization header with Bearer token format using the
    PHOENIX_API_KEY environment variable.

    Returns:
        Optional[Dict[str, str]]: Authorization header dictionary or None if API key not set.
    """
    api_key = os.environ.get(ENV_PHOENIX_API_KEY)
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
    if not (port := os.getenv(ENV_PHOENIX_GRPC_PORT)):
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
