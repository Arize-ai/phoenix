from __future__ import annotations

import ssl
from typing import Any, Container, Final, Literal, Mapping, TypedDict, get_type_hints

from sqlalchemy import URL
from typing_extensions import assert_never


def get_pg_config(
    url: URL,
    driver: Literal["psycopg", "asyncpg"],
) -> tuple[URL, dict[str, Any]]:
    """Convert SQLAlchemy URL to driver-specific configuration.

    Args:
        url: SQLAlchemy URL
        driver: "psycopg" or "asyncpg"

    Returns:
        Tuple of (base_url, connect_args):
        - base_url: URL with driver prefix and non-SSL parameters
        - connect_args: SSL configuration for the driver
    """
    # Create new URL with appropriate driver
    query = url.query
    ssl_args = _get_ssl_args(query)

    # Create base URL without SSL parameters
    base_url = url.set(
        drivername=f"postgresql+{driver}",
        query={k: v for k, v in query.items() if k not in _SSL_KEYS},
    )

    # Get appropriate SSL configuration based on driver
    if driver == "psycopg":
        connect_args = dict(ssl_args)
        # Remove asyncpg-specific parameters from base URL
        base_url = base_url.set(query=_remove_asyncpg_only_params(base_url.query))
    elif driver == "asyncpg":
        # Only create SSL context if we have SSL parameters and sslmode is not disable
        if ssl_args and ssl_args.get("sslmode") != "disable":
            connect_args = {"ssl": _get_ssl_context(ssl_args)}
        else:
            connect_args = {}
    else:
        assert_never(driver)
    return base_url, connect_args


class _SSLArgs(TypedDict, total=False):
    """SSL parameters for PostgreSQL connections.

    All fields are optional. Only includes parameters that can be converted to ssl.SSLContext.

    Attributes:
        sslmode: SSL mode (disable, allow, prefer, require, verify-ca, verify-full)
        sslrootcert: Path to root CA certificate
        sslcert: Path to client certificate
        sslkey: Path to client private key
        sslpassword: Password for private key
        sslcrl: Path to CRL file
        sslcrldir: Path to CRL directory
        sslsni: Enable SNI (0 or 1)
    """

    sslmode: str
    sslrootcert: str
    sslcert: str
    sslkey: str
    sslpassword: str
    sslcrl: str
    sslcrldir: str
    sslsni: str


_SSL_KEYS: Final[Container[str]] = get_type_hints(_SSLArgs).keys()


def _get_ssl_args(
    query_params: Mapping[str, str | tuple[str, ...]],
) -> _SSLArgs:
    """Extract SSL parameters from a SQLAlchemy URL query.

    Args:
        query_params: SQLAlchemy URL query parameters

    Returns:
        Dictionary of SSL parameters
    """
    result: _SSLArgs = {}

    def get_str(key: str) -> str | None:
        if value := query_params.get(key):
            if not isinstance(value, str):
                raise ValueError(f"Invalid value type for {key}: {type(value)}")
            return value
        return None

    if sslmode := get_str("sslmode"):
        result["sslmode"] = sslmode

    if ca_cert := get_str("sslrootcert"):
        result["sslrootcert"] = ca_cert

    if cert := get_str("sslcert"):
        result["sslcert"] = cert

    if key := get_str("sslkey"):
        result["sslkey"] = key

    if password := get_str("sslpassword"):
        result["sslpassword"] = password

    if crl := get_str("sslcrl"):
        result["sslcrl"] = crl

    if crl_dir := get_str("sslcrldir"):
        result["sslcrldir"] = crl_dir

    if sslsni := get_str("sslsni"):
        result["sslsni"] = sslsni

    return result


def _get_ssl_context(ssl_args: _SSLArgs) -> ssl.SSLContext:
    """Convert PostgreSQL SSL parameters to an SSL context.

    Args:
        ssl_args: PostgreSQL SSL parameters from _SSLArgs TypedDict

    Returns:
        Configured SSL context with:
        - Root CA certificate for server verification (if provided)
        - Client certificate and key for mutual TLS (if provided)
        - SSL mode appropriate verification settings
        - Certificate revocation list checking (if provided)
    """
    # Create SSL context
    ssl_context = ssl.create_default_context()

    # Load CA certificate if provided
    if ca_cert := ssl_args.get("sslrootcert"):
        ssl_context.load_verify_locations(cafile=ca_cert)

    # Load client certificates if provided
    if (cert := ssl_args.get("sslcert")) and (key := ssl_args.get("sslkey")):
        ssl_context.load_cert_chain(
            certfile=cert,
            keyfile=key,
            password=ssl_args.get("sslpassword"),
        )

    # Load CRL if provided
    if crl := ssl_args.get("sslcrl"):
        ssl_context.load_verify_locations(cafile=crl)
    if crl_dir := ssl_args.get("sslcrldir"):
        ssl_context.load_verify_locations(capath=crl_dir)

    # Set verification mode based on sslmode
    sslmode = ssl_args.get("sslmode", "prefer")
    if sslmode == "verify-full":
        # Full verification: certificate and hostname
        ssl_context.check_hostname = True
        ssl_context.verify_mode = ssl.CERT_REQUIRED
    elif sslmode == "verify-ca":
        # Certificate verification only
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_REQUIRED
    else:  # require, prefer, allow, disable
        # No verification, just encryption
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE

    return ssl_context


def _remove_asyncpg_only_params(
    query: Mapping[str, str | tuple[str, ...]],
) -> dict[str, str | tuple[str, ...]]:
    """Remove asyncpg-specific parameters from a SQLAlchemy URL query.

    Args:
        query: SQLAlchemy URL query parameters

    Returns:
        Dictionary of query parameters with asyncpg-specific parameters removed
    """
    return {k: v for k, v in query.items() if k not in _ASYNCPG_ONLY_KEYS}


# Asyncpg-specific parameter keys
_ASYNCPG_ONLY_KEYS: Final[tuple[str, ...]] = (
    "prepared_statement_cache_size",
    # Add other asyncpg-specific parameters here if needed
)
