"""
PostgreSQL SSL/TLS Connection Test Script

This script provides comprehensive testing of SSL/TLS connections to a PostgreSQL database
using three different drivers: asyncpg, psycopg, and SQLAlchemy 2.0. It supports both
configuration-based and DSN-based connection methods.

Features:
- Tests SSL/TLS connections with all major PostgreSQL Python drivers
- Supports both configuration-based and DSN-based connection methods
- Verifies SSL/TLS certificate validation
- Provides detailed connection diagnostics
- Generates a summary report of all tests
- Handles SSL parameter conversion between different driver formats

Requirements:
- Python 3.9+
- asyncpg
- psycopg
- SQLAlchemy 2.0+
- SSL certificates in ./certs/ directory:
  - root.crt (Root CA certificate)
  - client.crt (Client certificate)
  - client.key (Client private key)

Usage:
    python test_connection.py

Notes:
1. SSL/TLS Configuration:
   - The script uses 'verify-full' SSL mode for maximum security
   - Client certificates are required for mutual TLS authentication
   - Hostname verification is disabled for testing purposes
   - SSL parameters are automatically converted between driver formats:
     - psycopg: sslmode, sslrootcert, sslcert, sslkey
     - asyncpg: ssl, ssl_ca_certs_file, ssl_cert_file, ssl_key_file

2. Connection Methods:
   - Config-based: Uses DatabaseConfig class for structured configuration
   - DSN-based: Uses connection strings with SSL parameters
   - DSN conversion handles both psycopg and asyncpg formats

3. Error Handling:
   - All connection errors are caught and reported
   - Detailed error messages are provided for troubleshooting
   - Failed tests are marked with ❌ in the summary

4. Security Considerations:
   - Never commit certificate files to version control
   - Use strong passwords for certificate keys
   - Enable hostname verification in production
   - Rotate certificates regularly
"""

from __future__ import annotations

import asyncio
import ssl
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, Mapping, Optional, TypedDict
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import asyncpg
import psycopg
from sqlalchemy import URL, make_url, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# Get the directory containing this script
SCRIPT_DIR = Path(__file__).parent.absolute()


@dataclass
class DatabaseConfig:
    """Configuration for database connection.

    Attributes:
        host: Database server hostname or IP address
        port: Database server port
        user: Database user name
        database: Database name
        cert_dir: Directory containing SSL certificates
        root_cert: Root CA certificate filename
        client_cert: Client certificate filename
        client_key: Client private key filename
    """

    host: str = "127.0.0.1"
    port: int = 5432
    user: str = "postgres"
    database: str = "postgres"
    cert_dir: str = str(SCRIPT_DIR / "certs")
    root_cert: str = "root.crt"
    client_cert: str = "client.crt"
    client_key: str = "client.key"


@dataclass
class TestResults:
    """Test results for all connection methods.

    Attributes:
        asyncpg_config: Success status of asyncpg config-based test
        psycopg_config: Success status of psycopg config-based test
        sqlalchemy_asyncpg_config: Success status of SQLAlchemy asyncpg config-based test
        sqlalchemy_psycopg_config: Success status of SQLAlchemy psycopg config-based test
        asyncpg_dsn_psycopg: Success status of asyncpg DSN test with psycopg format
        psycopg_dsn_psycopg: Success status of psycopg DSN test with psycopg format
        sqlalchemy_asyncpg_dsn_psycopg: Success status of SQLAlchemy asyncpg DSN test with psycopg format
        sqlalchemy_psycopg_dsn_psycopg: Success status of SQLAlchemy psycopg DSN test with psycopg format
        asyncpg_dsn_asyncpg: Success status of asyncpg DSN test with asyncpg format
        psycopg_dsn_asyncpg: Success status of psycopg DSN test with asyncpg format
        sqlalchemy_asyncpg_dsn_asyncpg: Success status of SQLAlchemy asyncpg DSN test with asyncpg format
        sqlalchemy_psycopg_dsn_asyncpg: Success status of SQLAlchemy psycopg DSN test with asyncpg format
    """  # noqa: E501

    asyncpg_config: bool
    psycopg_config: bool
    sqlalchemy_asyncpg_config: bool
    sqlalchemy_psycopg_config: bool
    asyncpg_dsn_psycopg: bool
    psycopg_dsn_psycopg: bool
    sqlalchemy_asyncpg_dsn_psycopg: bool
    sqlalchemy_psycopg_dsn_psycopg: bool
    asyncpg_dsn_asyncpg: bool
    psycopg_dsn_asyncpg: bool
    sqlalchemy_asyncpg_dsn_asyncpg: bool
    sqlalchemy_psycopg_dsn_asyncpg: bool


# SSL parameter keys used across different PostgreSQL drivers
_SSL_KEYS = (
    "sslmode",
    "sslrootcert",
    "sslcert",
    "sslkey",  # psycopg format
    "ssl",
    "ssl_ca_certs_file",
    "ssl_cert_file",
    "ssl_key_file",  # asyncpg format
)

# Asyncpg-specific parameter keys
_ASYNC_PG_KEYS = (
    "prepared_statement_cache_size",
    # Add other asyncpg-specific parameters here if needed
)


class _RawSSLParams(TypedDict, total=False):
    """Raw SSL parameters from URL query.

    This TypedDict represents the raw SSL parameters that can be present in a URL query.
    The keys are optional (total=False) since not all parameters are required.

    Attributes:
        sslmode: SSL mode for the connection
        sslrootcert: Path to the root CA certificate file (psycopg format)
        ssl_ca_certs_file: Path to the root CA certificate file (asyncpg format)
        sslcert: Path to the client certificate file (psycopg format)
        ssl_cert_file: Path to the client certificate file (asyncpg format)
        sslkey: Path to the client private key file (psycopg format)
        ssl_key_file: Path to the client private key file (asyncpg format)
    """

    sslmode: str
    sslrootcert: str
    ssl_ca_certs_file: str
    sslcert: str
    ssl_cert_file: str
    sslkey: str
    ssl_key_file: str


class _PsycopgConnectArgs(TypedDict, total=False):
    """Connect arguments for psycopg driver.

    This TypedDict defines the possible connect arguments for the psycopg driver.
    The keys are optional (total=False) since not all parameters are required for
    every connection.

    Attributes:
        sslmode: SSL mode for the connection. Valid values are:
            - disable: No SSL
            - allow: Try non-SSL first, then SSL
            - prefer: Try SSL first, then non-SSL
            - require: Only SSL, no certificate verification
            - verify-ca: SSL with server certificate verification against CA
            - verify-full: SSL with server and client certificate verification
        sslrootcert: Path to the root CA certificate file
        sslcert: Path to the client certificate file
        sslkey: Path to the client private key file
    """

    sslmode: str
    sslrootcert: str
    sslcert: str
    sslkey: str


def _remove_asyncpg_params(
    query: Mapping[str, str | tuple[str, ...]],
) -> dict[str, str | tuple[str, ...]]:
    """Remove asyncpg-specific parameters from a SQLAlchemy URL query.

    Args:
        query: SQLAlchemy URL query parameters

    Returns:
        Dictionary of query parameters with asyncpg-specific parameters removed

    Note:
        This function removes parameters that are only used by asyncpg and should not be
        passed to other drivers like psycopg.

    Examples:
        >>> query = {"prepared_statement_cache_size": "1000"}
        >>> _remove_asyncpg_params(query)
        {}

        >>> query = {"application_name": "myapp"}
        >>> _remove_asyncpg_params(query)
        {"application_name": "myapp"}
    """  # noqa: E501
    return {k: v for k, v in query.items() if k not in _ASYNC_PG_KEYS}


def _get_ssl_params(query_params: Mapping[str, str | tuple[str, ...]]) -> _RawSSLParams:
    """Extract SSL parameters from a SQLAlchemy URL query.

    Args:
        query_params: SQLAlchemy URL query parameters

    Returns:
        Dictionary of raw SSL parameters with both psycopg and asyncpg format keys

    Raises:
        ValueError: If both psycopg and asyncpg formats are provided for the same parameter type

    Note:
        SQLAlchemy's URL.query can contain both single string values and sequences of strings.
        This is to support query parameters that can have multiple values, like:
        postgresql://user@host/db?param1=value1&param2=value2a&param2=value2b
        where param2 would be ["value2a", "value2b"].
        We handle this by taking the first value from sequences when needed.

    Examples:
        >>> query_params = {}
        >>> _get_ssl_params(query_params)
        {}

        >>> query_params = {"sslrootcert": "ca.crt"}
        >>> _get_ssl_params(query_params)
        {"sslrootcert": "ca.crt"}

        >>> query_params = {"sslrootcert": "ca.crt", "ssl_ca_certs_file": "ca2.crt"}
        Traceback (most recent call last):
            ...
        ValueError: Cannot mix psycopg and asyncpg formats for CA certificate
    """  # noqa: E501
    result: _RawSSLParams = {}

    def get_value(key: str) -> str | None:
        if value := query_params.get(key):
            if not isinstance(value, str):
                raise ValueError(f"Invalid value type for {key}: {type(value)}")
            return value
        return None

    # Handle root CA certificate
    psycopg_ca = get_value("sslrootcert")
    asyncpg_ca = get_value("ssl_ca_certs_file")
    if psycopg_ca is not None and asyncpg_ca is not None:
        raise ValueError("Cannot mix psycopg and asyncpg formats for CA certificate")
    if psycopg_ca is not None:
        result["sslrootcert"] = psycopg_ca
    if asyncpg_ca is not None:
        result["ssl_ca_certs_file"] = asyncpg_ca

    # Handle client certificate
    psycopg_cert = get_value("sslcert")
    asyncpg_cert = get_value("ssl_cert_file")
    if psycopg_cert is not None and asyncpg_cert is not None:
        raise ValueError("Cannot mix psycopg and asyncpg formats for client certificate")
    if psycopg_cert is not None:
        result["sslcert"] = psycopg_cert
    if asyncpg_cert is not None:
        result["ssl_cert_file"] = asyncpg_cert

    # Handle client private key
    psycopg_key = get_value("sslkey")
    asyncpg_key = get_value("ssl_key_file")
    if psycopg_key is not None and asyncpg_key is not None:
        raise ValueError("Cannot mix psycopg and asyncpg formats for client key")
    if psycopg_key is not None:
        result["sslkey"] = psycopg_key
    if asyncpg_key is not None:
        result["ssl_key_file"] = asyncpg_key

    # Handle sslmode
    if sslmode := get_value("sslmode"):
        result["sslmode"] = sslmode

    return result


def _split_ssl_params(
    query: Mapping[str, str | tuple[str, ...]],
) -> tuple[dict[str, str | tuple[str, ...]], _RawSSLParams]:
    """Split SSL parameters from a SQLAlchemy URL query.

    Args:
        query: SQLAlchemy URL query parameters

    Returns:
        Tuple of (query_without_ssl, ssl_params) where:
        - query_without_ssl: Dictionary of query parameters with SSL-related parameters removed
        - ssl_params: Dictionary of raw SSL parameters

    Examples:
        >>> query = {"sslmode": "require", "sslrootcert": "ca.crt"}
        >>> query_without_ssl, ssl_params = _split_ssl_params(query)
        >>> query_without_ssl
        {}
        >>> ssl_params
        {"sslmode": "require", "sslrootcert": "ca.crt"}
    """  # noqa: E501
    return {k: v for k, v in query.items() if k not in _SSL_KEYS}, _get_ssl_params(query)


def _get_psycopg_connect_args(raw_ssl_params: _RawSSLParams) -> _PsycopgConnectArgs:
    """Create connect_args dictionary for psycopg driver.

    Args:
        raw_ssl_params: Raw SSL parameters from URL query

    Returns:
        Dictionary of connect_args for psycopg, including:
        - sslmode: SSL mode from raw_ssl_params or determined based on available certificates
        - sslrootcert: Path to root CA certificate (if provided)
        - sslcert: Path to client certificate (if provided)
        - sslkey: Path to client private key (if provided)

    Examples:
        >>> raw_ssl_params = {}
        >>> _get_psycopg_connect_args(raw_ssl_params)
        {"sslmode": "verify-ca"}

        >>> raw_ssl_params = {"sslrootcert": "ca.crt", "sslcert": "client.crt", "sslkey": "client.key"}
        >>> _get_psycopg_connect_args(raw_ssl_params)
        {"sslmode": "verify-full", "sslrootcert": "ca.crt", "sslcert": "client.crt", "sslkey": "client.key"}

        >>> raw_ssl_params = {"sslmode": "require", "sslrootcert": "ca.crt"}
        >>> _get_psycopg_connect_args(raw_ssl_params)
        {"sslmode": "require", "sslrootcert": "ca.crt"}
    """  # noqa: E501
    result: _PsycopgConnectArgs = {}

    # Set sslmode based on provided value or determine from certificates
    if sslmode := raw_ssl_params.get("sslmode"):
        result["sslmode"] = sslmode
    else:
        result["sslmode"] = (
            "verify-full"
            if (raw_ssl_params.get("sslcert") or raw_ssl_params.get("ssl_cert_file")) is not None
            or (raw_ssl_params.get("sslkey") or raw_ssl_params.get("ssl_key_file")) is not None
            else "verify-ca"
        )

    # Add root CA certificate if provided
    if ca_certs := (raw_ssl_params.get("sslrootcert") or raw_ssl_params.get("ssl_ca_certs_file")):
        result["sslrootcert"] = ca_certs

    # Add client certificate if provided
    if cert := (raw_ssl_params.get("sslcert") or raw_ssl_params.get("ssl_cert_file")):
        result["sslcert"] = cert

    # Add client private key if provided
    if key := (raw_ssl_params.get("sslkey") or raw_ssl_params.get("ssl_key_file")):
        result["sslkey"] = key

    return result


def _get_ssl_context(raw_ssl_params: _RawSSLParams) -> ssl.SSLContext:
    """Create an SSL context from raw SSL parameters.

    Args:
        raw_ssl_params: Raw SSL parameters from URL query

    Returns:
        Configured SSL context with:
        - Root CA certificate for server verification
        - Client certificate and key for mutual TLS
        - Disabled hostname verification (for testing)

    Note:
        The SSL parameters are in raw format from the URL query, supporting both
        psycopg and asyncpg parameter formats.
    """  # noqa: E501
    ssl_context = ssl.create_default_context(
        purpose=ssl.Purpose.SERVER_AUTH,
        cafile=raw_ssl_params.get("sslrootcert") or raw_ssl_params.get("ssl_ca_certs_file"),
    )

    certfile = raw_ssl_params.get("sslcert") or raw_ssl_params.get("ssl_cert_file")
    keyfile = raw_ssl_params.get("sslkey") or raw_ssl_params.get("ssl_key_file")
    if certfile is not None and keyfile is not None:
        ssl_context.load_cert_chain(certfile=certfile, keyfile=keyfile)

    return ssl_context


def _get_sqlalchemy_config(
    url: URL,
    driver: Literal["psycopg", "asyncpg"] = "psycopg",
) -> tuple[URL, dict[str, Any]]:
    """Convert a SQLAlchemy URL to configuration for a specific driver.

    This function converts a SQLAlchemy URL to a format suitable for a specific driver.
    It preserves all non-SSL parameters and handles SSL configuration based on the chosen driver.

    The function:
    1. Creates a new URL with the appropriate SQLAlchemy driver prefix
    2. Returns SSL configuration based on the driver:
       - For psycopg: Individual SSL parameters (sslmode, sslrootcert, etc.)
       - For asyncpg: SSL context object
    3. Handles driver-specific parameters:
       - For psycopg: Removes asyncpg-specific parameters
       - For asyncpg: Preserves all parameters

    Args:
        url: SQLAlchemy URL object
        driver: SQLAlchemy driver to use ("psycopg" or "asyncpg"). Defaults to "psycopg"

    Returns:
        Tuple of (base_url, connect_args) where:
        - base_url: SQLAlchemy URL object with driver prefix and preserved non-SSL parameters
        - connect_args: Dictionary of SSL configuration parameters appropriate for the driver

    Example:
        >>> url = URL.create("postgresql", username="user", host="host", database="db")
        >>> base_url, connect_args = _get_sqlalchemy_config(url, "psycopg")
        >>> print(base_url)
        postgresql+psycopg://user@host/db
    """  # noqa: E501
    # Create new URL with appropriate driver
    query, raw_ssl_params = _split_ssl_params(url.query or {})
    base_url = url.set(
        drivername=f"postgresql+{driver}",
        query=query,
    )

    # Get appropriate SSL configuration based on driver
    if driver == "psycopg":
        # Convert _PsycopgConnectArgs to dict[str, Any]
        connect_args = dict(_get_psycopg_connect_args(raw_ssl_params))
        # Remove asyncpg-specific parameters for psycopg
        base_url = base_url.set(query=_remove_asyncpg_params(query))
    else:  # asyncpg
        connect_args = {"ssl": _get_ssl_context(raw_ssl_params)}

    return base_url, connect_args


def _create_ssl_context(config: DatabaseConfig) -> ssl.SSLContext:
    """Create and configure SSL context for database connection.

    Args:
        config: Database configuration containing certificate paths

    Returns:
        Configured SSL context with:
        - Root CA certificate for server verification
        - Client certificate and key for mutual TLS
        - Disabled hostname verification (for testing)

    Note:
        Hostname verification should be enabled in production environments.
    """  # noqa: E501
    cert_dir = Path(config.cert_dir)
    ssl_context = ssl.create_default_context(
        purpose=ssl.Purpose.SERVER_AUTH,
        cafile=str(cert_dir / config.root_cert),
    )
    ssl_context.load_cert_chain(
        certfile=str(cert_dir / config.client_cert),
        keyfile=str(cert_dir / config.client_key),
    )
    ssl_context.check_hostname = False
    return ssl_context


async def test_connection_asyncpg(config: Optional[DatabaseConfig] = None) -> None:
    """Test SSL/TLS connection using asyncpg with configuration.

    Args:
        config: Optional database configuration. If None, defaults will be used.

    Raises:
        Exception: If connection fails or SSL/TLS verification fails
    """  # noqa: E501
    if config is None:
        config = DatabaseConfig()

    print("\n=== Testing with asyncpg ===")
    print(f"Working directory: {Path.cwd()}")

    try:
        ssl_context = _create_ssl_context(config)
        conn = await asyncpg.connect(
            host=config.host,
            port=config.port,
            user=config.user,
            database=config.database,
            ssl=ssl_context,
        )
        version = await conn.fetchval("SELECT version()")
        print(f"Connected successfully to: {version}")
        await conn.close()
    except Exception as e:
        print(f"Connection error: {e}")
        raise


async def test_connection_asyncpg_dsn(dsn: str) -> None:
    """Test SSL/TLS connection using asyncpg with DSN.

    Args:
        dsn: Connection string in either format:
            - psycopg style: postgresql://user@host:port/database?sslmode=verify-full&sslrootcert=path&sslcert=path&sslkey=path
            - asyncpg style: postgresql://user@host:port/database?ssl=true&ssl_ca_certs_file=path&ssl_cert_file=path&ssl_key_file=path

    Raises:
        Exception: If connection fails or SSL/TLS verification fails
    """
    print("\n=== Testing with asyncpg (DSN) ===")
    print(f"Input DSN: {dsn}")

    try:
        # Parse the DSN and get SSL parameters
        parsed = urlparse(dsn)
        query_params = dict(parse_qsl(parsed.query))
        _, raw_ssl_params = _split_ssl_params(query_params)

        # Get base DSN without SSL parameters
        base_dsn = _remove_ssl_params(dsn)
        print(f"Base DSN: {base_dsn}")

        # Get SSL context
        ssl_context = _get_ssl_context(raw_ssl_params)
        print(f"SSL Parameters: {raw_ssl_params}")

        print("\nConnection Details:")
        print("  Driver: asyncpg")
        print("  Format: asyncpg")
        print(f"  Base URL: {base_dsn}")
        print(f"  SSL Context: {'Present' if ssl_context else 'None'}")

        print("\nAttempting connection with asyncpg...")
        conn = await asyncpg.connect(base_dsn, ssl=ssl_context)
        version = await conn.fetchval("SELECT version()")
        print(f"✅ Connected successfully to: {version}")
        await conn.close()
    except Exception as e:
        print(f"❌ Connection error: {e}")
        raise


async def test_connection_psycopg(config: Optional[DatabaseConfig] = None) -> None:
    """Test SSL/TLS connection using psycopg with configuration.

    Args:
        config: Optional database configuration. If None, defaults will be used.

    Raises:
        Exception: If connection fails or SSL/TLS verification fails
    """
    if config is None:
        config = DatabaseConfig()

    print("\n=== Testing with psycopg ===")
    print(f"Working directory: {Path.cwd()}")

    try:
        cert_dir = Path(config.cert_dir)
        conn = await psycopg.AsyncConnection.connect(
            host=config.host,
            port=config.port,
            user=config.user,
            dbname=config.database,
            sslmode="verify-full",
            sslrootcert=str(cert_dir / config.root_cert),
            sslcert=str(cert_dir / config.client_cert),
            sslkey=str(cert_dir / config.client_key),
        )
        async with conn.cursor() as cur:
            await cur.execute("SELECT version()")
            version = (await cur.fetchone())[0]
        print(f"Connected successfully to: {version}")
        await conn.close()
    except Exception as e:
        print(f"Connection error: {e}")
        raise


async def test_connection_psycopg_dsn(dsn: str) -> None:
    """Test SSL/TLS connection using psycopg with DSN.

    Args:
        dsn: Connection string in either format:
            - psycopg style: postgresql://user@host:port/database?sslmode=verify-full&sslrootcert=path&sslcert=path&sslkey=path
            - asyncpg style: postgresql://user@host:port/database?ssl=true&ssl_ca_certs_file=path&ssl_cert_file=path&ssl_key_file=path

    Raises:
        Exception: If connection fails or SSL/TLS verification fails
    """
    print("\n=== Testing with psycopg (DSN) ===")
    print(f"Input DSN: {dsn}")

    try:
        # Parse the DSN and get SSL parameters
        parsed = urlparse(dsn)
        query_params = dict(parse_qsl(parsed.query))
        _, raw_ssl_params = _split_ssl_params(query_params)

        # Get base DSN without SSL parameters
        base_dsn = _remove_ssl_params(dsn)
        print(f"Base DSN: {base_dsn}")

        # Get psycopg connect args
        connect_args = _get_psycopg_connect_args(raw_ssl_params)
        print(f"SSL Parameters: {connect_args}")

        print("\nConnection Details:")
        print("  Driver: psycopg")
        print("  Format: psycopg")
        print(f"  Base URL: {base_dsn}")
        print(f"  Connect Args: {connect_args}")

        print("\nAttempting connection with psycopg...")
        conn = await psycopg.AsyncConnection.connect(base_dsn, **connect_args)
        async with conn.cursor() as cur:
            await cur.execute("SELECT version()")
            version = (await cur.fetchone())[0]
        print(f"✅ Connected successfully to: {version}")
        await conn.close()
    except Exception as e:
        print(f"❌ Connection error: {e}")
        raise


async def test_connection_sqlalchemy_asyncpg(config: Optional[DatabaseConfig] = None) -> None:
    """Test SSL/TLS connection using SQLAlchemy with asyncpg and configuration.

    Args:
        config: Optional database configuration. If None, defaults will be used.

    Raises:
        Exception: If connection fails or SSL/TLS verification fails
    """
    if config is None:
        config = DatabaseConfig()

    print("\n=== Testing with SQLAlchemy 2.0 (asyncpg) ===")
    print(f"Working directory: {Path.cwd()}")

    try:
        ssl_context = _create_ssl_context(config)
        # Construct URL using urlparse/urlunparse
        base_url = urlunparse(
            (
                "postgresql+asyncpg",  # scheme
                f"{config.user}@{config.host}:{config.port}",  # netloc
                f"/{config.database}",  # path
                "",  # params
                "",  # query
                "",  # fragment
            )
        )
        engine = create_async_engine(base_url, connect_args={"ssl": ssl_context})
        async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        async with async_session() as session:
            result = await session.execute(text("SELECT version()"))
            version = result.scalar()
            print(f"Connected successfully to: {version}")
        await engine.dispose()
    except Exception as e:
        print(f"Connection error: {e}")
        raise


async def test_connection_sqlalchemy_psycopg(config: Optional[DatabaseConfig] = None) -> None:
    """Test SSL/TLS connection using SQLAlchemy with psycopg and configuration.

    Args:
        config: Optional database configuration. If None, defaults will be used.

    Raises:
        Exception: If connection fails or SSL/TLS verification fails
    """
    if config is None:
        config = DatabaseConfig()

    print("\n=== Testing with SQLAlchemy 2.0 (psycopg) ===")
    print(f"Working directory: {Path.cwd()}")

    try:
        cert_dir = Path(config.cert_dir)
        # Construct URL using urlparse/urlunparse
        base_url = urlunparse(
            (
                "postgresql+psycopg",  # scheme
                f"{config.user}@{config.host}:{config.port}",  # netloc
                f"/{config.database}",  # path
                "",  # params
                "",  # query
                "",  # fragment
            )
        )
        engine = create_async_engine(
            base_url,
            connect_args={
                "sslmode": "verify-full",
                "sslrootcert": str(cert_dir / config.root_cert),
                "sslcert": str(cert_dir / config.client_cert),
                "sslkey": str(cert_dir / config.client_key),
            },
        )
        async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        async with async_session() as session:
            result = await session.execute(text("SELECT version()"))
            version = result.scalar()
            print(f"Connected successfully to: {version}")
        await engine.dispose()
    except Exception as e:
        print(f"Connection error: {e}")
        raise


async def test_connection_sqlalchemy_asyncpg_dsn(dsn: str) -> None:
    """Test SSL/TLS connection using SQLAlchemy with asyncpg and DSN.

    Args:
        dsn: Connection string in either format:
            - psycopg style: postgresql://user@host:port/database?sslmode=verify-full&sslrootcert=path&sslcert=path&sslkey=path
            - asyncpg style: postgresql://user@host:port/database?ssl=true&ssl_ca_certs_file=path&ssl_cert_file=path&ssl_key_file=path

    Raises:
        Exception: If connection fails or SSL/TLS verification fails
    """
    print("\n=== Testing with SQLAlchemy 2.0 (asyncpg DSN) ===")
    print(f"Input DSN: {dsn}")

    try:
        # Convert DSN directly to SQLAlchemy URL
        url = make_url(dsn)
        query_params = dict(url.query)
        _, raw_ssl_params = _split_ssl_params(query_params)

        # Set the driver and remove SSL parameters from query
        url = url.set(
            drivername="postgresql+asyncpg",
            query={k: v for k, v in query_params.items() if k not in _SSL_KEYS},
        )

        # Get SSL context for connect_args
        connect_args = {"ssl": _get_ssl_context(raw_ssl_params)}
        print(f"Final URL: {url}")

        print("\nConnection Details:")
        print("  Driver: SQLAlchemy (asyncpg)")
        print("  Format: asyncpg")
        print(f"  Base URL: {url}")
        print(f"  Connect Args: {connect_args}")

        print("\nCreating SQLAlchemy engine...")
        engine = create_async_engine(url, connect_args=connect_args)
        async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        print("Attempting connection...")
        async with async_session() as session:
            result = await session.execute(text("SELECT version()"))
            version = result.scalar()
            print(f"✅ Connected successfully to: {version}")
        await engine.dispose()
    except Exception as e:
        print(f"❌ Connection error: {e}")
        raise


async def test_connection_sqlalchemy_psycopg_dsn(dsn: str) -> None:
    """Test SSL/TLS connection using SQLAlchemy with psycopg and DSN.

    Args:
        dsn: Connection string in either format:
            - psycopg style: postgresql://user@host:port/database?sslmode=verify-full&sslrootcert=path&sslcert=path&sslkey=path
            - asyncpg style: postgresql://user@host:port/database?ssl=true&ssl_ca_certs_file=path&ssl_cert_file=path&ssl_key_file=path

    Raises:
        Exception: If connection fails or SSL/TLS verification fails
    """
    print("\n=== Testing with SQLAlchemy 2.0 (psycopg DSN) ===")
    print(f"Input DSN: {dsn}")

    try:
        # Convert DSN directly to SQLAlchemy URL
        url = make_url(dsn)
        query_params = dict(url.query)
        _, raw_ssl_params = _split_ssl_params(query_params)

        # Set the driver and remove SSL parameters from query
        url = url.set(
            drivername="postgresql+psycopg",
            query={k: v for k, v in query_params.items() if k not in _SSL_KEYS},
        )

        # Get psycopg connect args
        connect_args = _get_psycopg_connect_args(raw_ssl_params)
        print(f"Final URL: {url}")

        print("\nConnection Details:")
        print("  Driver: SQLAlchemy (psycopg)")
        print("  Format: psycopg")
        print(f"  Base URL: {url}")
        print(f"  Connect Args: {connect_args}")

        print("\nCreating SQLAlchemy engine...")
        engine = create_async_engine(url, connect_args=connect_args)
        async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        print("Attempting connection...")
        async with async_session() as session:
            result = await session.execute(text("SELECT version()"))
            version = result.scalar()
            print(f"✅ Connected successfully to: {version}")
        await engine.dispose()
    except Exception as e:
        print(f"❌ Connection error: {e}")
        raise


def format_test_results(results: TestResults) -> None:
    """Print test results in a clear, structured format.

    Args:
        results: TestResults object containing test results
    """
    print("\n=== Test Results ===")
    print("\nConfig-based connections:")
    print(f"  {'✅' if results.asyncpg_config else '❌'} asyncpg")
    print(f"  {'✅' if results.psycopg_config else '❌'} psycopg")
    print(f"  {'✅' if results.sqlalchemy_asyncpg_config else '❌'} SQLAlchemy (asyncpg)")
    print(f"  {'✅' if results.sqlalchemy_psycopg_config else '❌'} SQLAlchemy (psycopg)")

    print("\nDSN-based connections (psycopg format):")
    print(f"  {'✅' if results.asyncpg_dsn_psycopg else '❌'} asyncpg")
    print(f"  {'✅' if results.psycopg_dsn_psycopg else '❌'} psycopg")
    print(f"  {'✅' if results.sqlalchemy_asyncpg_dsn_psycopg else '❌'} SQLAlchemy (asyncpg)")
    print(f"  {'✅' if results.sqlalchemy_psycopg_dsn_psycopg else '❌'} SQLAlchemy (psycopg)")

    print("\nDSN-based connections (asyncpg format):")
    print(f"  {'✅' if results.asyncpg_dsn_asyncpg else '❌'} asyncpg")
    print(f"  {'✅' if results.psycopg_dsn_asyncpg else '❌'} psycopg")
    print(f"  {'✅' if results.sqlalchemy_asyncpg_dsn_asyncpg else '❌'} SQLAlchemy (asyncpg)")
    print(f"  {'✅' if results.sqlalchemy_psycopg_dsn_asyncpg else '❌'} SQLAlchemy (psycopg)")


async def main() -> None:
    """Run connection tests for all drivers and display results.

    This function:
    1. Tests all drivers with both config-based and DSN-based methods
    2. Tracks success/failure of each test
    3. Displays a summary of results
    4. Provides detailed error messages for failed tests

    The test results show:
    - Success/failure for each driver and connection method
    - Overall test status
    - Detailed error messages for troubleshooting
    """
    print(f"Working directory: {Path.cwd()}")
    config = DatabaseConfig()
    test_results = TestResults(
        asyncpg_config=False,
        psycopg_config=False,
        sqlalchemy_asyncpg_config=False,
        sqlalchemy_psycopg_config=False,
        asyncpg_dsn_psycopg=False,
        psycopg_dsn_psycopg=False,
        sqlalchemy_asyncpg_dsn_psycopg=False,
        sqlalchemy_psycopg_dsn_psycopg=False,
        asyncpg_dsn_asyncpg=False,
        psycopg_dsn_asyncpg=False,
        sqlalchemy_asyncpg_dsn_asyncpg=False,
        sqlalchemy_psycopg_dsn_asyncpg=False,
    )

    # Test with config
    try:
        await test_connection_asyncpg(config)
        test_results.asyncpg_config = True
    except Exception as e:
        print(f"\n❌ asyncpg config test failed: {e}")

    try:
        await test_connection_psycopg(config)
        test_results.psycopg_config = True
    except Exception as e:
        print(f"\n❌ psycopg config test failed: {e}")

    try:
        await test_connection_sqlalchemy_asyncpg(config)
        test_results.sqlalchemy_asyncpg_config = True
    except Exception as e:
        print(f"\n❌ SQLAlchemy asyncpg config test failed: {e}")

    try:
        await test_connection_sqlalchemy_psycopg(config)
        test_results.sqlalchemy_psycopg_config = True
    except Exception as e:
        print(f"\n❌ SQLAlchemy psycopg config test failed: {e}")

    # Test with DSNs
    cert_dir = Path(config.cert_dir)

    # Create both DSN formats
    print("\n=== Creating DSNs ===")

    # Common URL components
    scheme = "postgresql"
    netloc = f"{config.user}@{config.host}:{config.port}"
    path = f"/{config.database}"
    params = ""
    fragment = ""

    # Create psycopg DSN
    psycopg_query = urlencode(
        {
            "sslmode": "verify-full",
            "sslrootcert": str(cert_dir / config.root_cert),
            "sslcert": str(cert_dir / config.client_cert),
            "sslkey": str(cert_dir / config.client_key),
        }
    )

    psycopg_dsn = urlunparse((scheme, netloc, path, params, psycopg_query, fragment))
    print(f"psycopg DSN: {psycopg_dsn}")

    # Create asyncpg DSN
    asyncpg_query = urlencode(
        {
            "ssl": "true",
            "ssl_ca_certs_file": str(cert_dir / config.root_cert),
            "ssl_cert_file": str(cert_dir / config.client_cert),
            "ssl_key_file": str(cert_dir / config.client_key),
        }
    )

    asyncpg_dsn = urlunparse((scheme, netloc, path, params, asyncpg_query, fragment))
    print(f"asyncpg DSN: {asyncpg_dsn}")

    # Test with psycopg DSN format
    print("\n=== Testing with psycopg DSN format ===")
    try:
        await test_connection_asyncpg_dsn(psycopg_dsn)
        test_results.asyncpg_dsn_psycopg = True
    except Exception as e:
        print(f"\n❌ asyncpg DSN test failed: {e}")

    try:
        await test_connection_psycopg_dsn(psycopg_dsn)
        test_results.psycopg_dsn_psycopg = True
    except Exception as e:
        print(f"\n❌ psycopg DSN test failed: {e}")

    try:
        await test_connection_sqlalchemy_asyncpg_dsn(psycopg_dsn)
        test_results.sqlalchemy_asyncpg_dsn_psycopg = True
    except Exception as e:
        print(f"\n❌ SQLAlchemy asyncpg DSN test failed: {e}")

    try:
        await test_connection_sqlalchemy_psycopg_dsn(psycopg_dsn)
        test_results.sqlalchemy_psycopg_dsn_psycopg = True
    except Exception as e:
        print(f"\n❌ SQLAlchemy psycopg DSN test failed: {e}")

    # Test with asyncpg DSN format
    print("\n=== Testing with asyncpg DSN format ===")
    try:
        await test_connection_asyncpg_dsn(asyncpg_dsn)
        test_results.asyncpg_dsn_asyncpg = True
    except Exception as e:
        print(f"\n❌ asyncpg DSN test failed: {e}")

    try:
        await test_connection_psycopg_dsn(asyncpg_dsn)
        test_results.psycopg_dsn_asyncpg = True
    except Exception as e:
        print(f"\n❌ psycopg DSN test failed: {e}")

    try:
        await test_connection_sqlalchemy_asyncpg_dsn(asyncpg_dsn)
        test_results.sqlalchemy_asyncpg_dsn_asyncpg = True
    except Exception as e:
        print(f"\n❌ SQLAlchemy asyncpg DSN test failed: {e}")

    try:
        await test_connection_sqlalchemy_psycopg_dsn(asyncpg_dsn)
        test_results.sqlalchemy_psycopg_dsn_asyncpg = True
    except Exception as e:
        print(f"\n❌ SQLAlchemy psycopg DSN test failed: {e}")

    # Print summary
    if all(vars(test_results).values()):
        print("\n✅ All tests completed successfully!")
        print("✅ All drivers successfully established SSL/TLS connections")
        print("✅ Both config-based and DSN-based connections worked")
    else:
        print("\n❌ Some tests failed!")
        print("❌ Not all drivers successfully established SSL/TLS connections")
        print("❌ Some config-based or DSN-based connections failed")

    # Print formatted test results
    format_test_results(test_results)

    # Print connection strings with absolute paths
    print("\n========== Connection Strings ==========")
    print("Use these connection strings to connect with SSL/TLS:")
    print("\n1. psycopg format:")
    print(
        f"postgresql://postgres:phoenix@localhost:5432/postgres?sslmode=verify-full"
        f"&sslrootcert={cert_dir / config.root_cert}"
        f"&sslcert={cert_dir / config.client_cert}"
        f"&sslkey={cert_dir / config.client_key}"
    )
    print("\n2. asyncpg format:")
    print(
        f"postgresql://postgres:phoenix@localhost:5432/postgres?ssl=true"
        f"&ssl_ca_certs_file={cert_dir / config.root_cert}"
        f"&ssl_cert_file={cert_dir / config.client_cert}"
        f"&ssl_key_file={cert_dir / config.client_key}"
    )
    print("\n3. Key-value format:")
    print(
        f"host=localhost port=5432 dbname=postgres user=postgres password=phoenix "
        f"sslmode=verify-full sslrootcert={cert_dir / config.root_cert} "
        f"sslcert={cert_dir / config.client_cert} sslkey={cert_dir / config.client_key}"
    )


def _remove_ssl_params(dsn: str) -> str:
    """Remove SSL parameters from a DSN.

    Args:
        dsn: PostgreSQL connection string

    Returns:
        DSN string without SSL parameters. The returned DSN will have all SSL-related
        parameters removed, including:
        - psycopg format: sslmode, sslrootcert, sslcert, sslkey
        - asyncpg format: ssl, ssl_ca_certs_file, ssl_cert_file, ssl_key_file

    Examples:
        >>> _remove_ssl_params("postgresql://user@host/db?ssl=true&ssl_ca_certs_file=cert.crt")
        "postgresql://user@host/db"

        >>> _remove_ssl_params("postgresql://user@host/db?sslmode=verify-full&sslrootcert=cert.crt")
        "postgresql://user@host/db"

        >>> _remove_ssl_params("postgresql://user@host/db?application_name=myapp")
        "postgresql://user@host/db?application_name=myapp"
    """
    parsed = urlparse(dsn)
    query_params = dict(parse_qsl(parsed.query))

    # Remove all SSL-related parameters
    non_ssl_params = {k: v for k, v in query_params.items() if k not in _SSL_KEYS}

    scheme = parsed.scheme
    netloc = parsed.netloc
    path = parsed.path
    path_params = parsed.params
    query = urlencode(non_ssl_params) if non_ssl_params else ""
    fragment = parsed.fragment

    return urlunparse((scheme, netloc, path, path_params, query, fragment))


if __name__ == "__main__":
    asyncio.run(main())
