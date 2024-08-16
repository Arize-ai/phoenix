import os
import urllib
from logging import getLogger
from re import compile
from typing import Dict, List, Optional

_logger = getLogger(__name__)

# Environment variables specific to the subpackage
ENV_PHOENIX_COLLECTOR_ENDPOINT = "PHOENIX_COLLECTOR_ENDPOINT"
ENV_PHOENIX_PROJECT_NAME = "PHOENIX_PROJECT_NAME"
ENV_PHOENIX_CLIENT_HEADERS = "PHOENIX_CLIENT_HEADERS"


def get_env_collector_endpoint() -> Optional[str]:
    return os.getenv(ENV_PHOENIX_COLLECTOR_ENDPOINT)


def get_env_project_name() -> str:
    return os.getenv(ENV_PHOENIX_PROJECT_NAME, "default")


def get_env_client_headers() -> Optional[Dict[str, str]]:
    if headers_str := os.getenv(ENV_PHOENIX_CLIENT_HEADERS):
        return parse_env_headers(headers_str)
    return None


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
            if len(parts) == 2:
                name, value = parts
                encoded_header = f"{urllib.parse.quote(name)}={urllib.parse.quote(value)}"
            match = _HEADER_PATTERN.fullmatch(encoded_header.strip())
            if not match:
                _logger.warning(
                    "Header format invalid! Header values in environment variables must be "
                    "URL encoded: %s",
                    header,
                )
                continue
            _logger.warning(
                f"Header values in environment variables should be URL encoded, ``{header}`` "
                f"was urlencoded to: ``{encoded_header}``"
            )

        name, value = header.split("=", 1)
        name = urllib.parse.unquote(name).strip().lower()
        value = urllib.parse.unquote(value).strip()
        headers[name] = value

    return headers
