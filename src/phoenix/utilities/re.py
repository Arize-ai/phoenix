from logging import getLogger
from re import compile, split
from typing import Dict, List
from urllib.parse import unquote

_logger = getLogger(__name__)

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

    src: https://github.com/open-telemetry/opentelemetry-python/blob/2d5cd58f33bd8a16f45f30be620a96699bc14297/opentelemetry-api/src/opentelemetry/util/re.py#L52
    """
    headers: Dict[str, str] = {}
    headers_list: List[str] = split(_DELIMITER_PATTERN, s)
    for header in headers_list:
        if not header:  # empty string
            continue
        match = _HEADER_PATTERN.fullmatch(header.strip())
        if not match:
            _logger.warning(
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
