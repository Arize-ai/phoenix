"""
PostgreSQL SSL/TLS Connection Test Script

This script provides comprehensive testing of SSL/TLS connections to a PostgreSQL database
using both psycopg and asyncpg drivers. It supports both configuration-based and DSN-based
connection methods.

Features:
- Tests SSL/TLS connections with both PostgreSQL Python drivers
- Supports both configuration-based and DSN-based connection methods
- Verifies SSL/TLS certificate validation
- Provides detailed connection diagnostics
- Generates a summary report of all tests

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

import asyncpg
import psycopg
from sqlalchemy import URL, make_url, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from typing_extensions import assert_never

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
        asyncpg_dsn: Success status of asyncpg DSN test
        psycopg_dsn: Success status of psycopg DSN test
        sqlalchemy_asyncpg_dsn: Success status of SQLAlchemy asyncpg DSN test
        sqlalchemy_psycopg_dsn: Success status of SQLAlchemy psycopg DSN test
    """

    asyncpg_config: bool
    psycopg_config: bool
    sqlalchemy_asyncpg_config: bool
    sqlalchemy_psycopg_config: bool
    asyncpg_dsn: bool
    psycopg_dsn: bool
    sqlalchemy_asyncpg_dsn: bool
    sqlalchemy_psycopg_dsn: bool


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
            certfile=cert, keyfile=key, password=ssl_args.get("sslpassword")
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


# SSL parameter keys used across different PostgreSQL drivers
_SSL_KEYS = (
    "sslmode",
    "sslrootcert",
    "sslcert",
    "sslkey",
    "sslpassword",
    "sslcrl",
    "sslcrldir",
    "sslsni",
)

# Asyncpg-specific parameter keys
_ASYNCPG_ONLY_KEYS = (
    "prepared_statement_cache_size",
    # Add other asyncpg-specific parameters here if needed
)


async def test_connection_asyncpg(config: Optional[DatabaseConfig] = None) -> None:
    """Test SSL/TLS connection using asyncpg with configuration.

    Args:
        config: Optional database configuration. If None, defaults will be used.

    Raises:
        Exception: If connection fails or SSL/TLS verification fails
    """
    if config is None:
        config = DatabaseConfig()

    print("\n=== Testing with asyncpg ===")
    print(f"Working directory: {Path.cwd()}")

    try:
        cert_dir = Path(config.cert_dir)
        ssl_args: _SSLArgs = {
            "sslmode": "verify-full",
            "sslrootcert": str(cert_dir / config.root_cert),
            "sslcert": str(cert_dir / config.client_cert),
            "sslkey": str(cert_dir / config.client_key),
        }
        ssl_context = _get_ssl_context(ssl_args)
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
        ssl_args: _SSLArgs = {
            "sslmode": "verify-full",
            "sslrootcert": str(cert_dir / config.root_cert),
            "sslcert": str(cert_dir / config.client_cert),
            "sslkey": str(cert_dir / config.client_key),
        }
        conn = await psycopg.AsyncConnection.connect(
            host=config.host,
            port=config.port,
            user=config.user,
            dbname=config.database,
            **ssl_args,
        )
        async with conn.cursor() as cur:
            await cur.execute("SELECT version()")
            version = (await cur.fetchone())[0]
        print(f"Connected successfully to: {version}")
        await conn.close()
    except Exception as e:
        print(f"Connection error: {e}")
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
        cert_dir = Path(config.cert_dir)
        url = make_url(
            f"postgresql://{config.user}@{config.host}:{config.port}/{config.database}"
            f"?sslmode=verify-full"
            f"&sslrootcert={cert_dir / config.root_cert}"
            f"&sslcert={cert_dir / config.client_cert}"
            f"&sslkey={cert_dir / config.client_key}"
        )
        base_url, connect_args = get_pg_config(url, "asyncpg")
        engine = create_async_engine(base_url, connect_args=connect_args)
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
        url = make_url(
            f"postgresql://{config.user}@{config.host}:{config.port}/{config.database}"
            f"?sslmode=verify-full"
            f"&sslrootcert={cert_dir / config.root_cert}"
            f"&sslcert={cert_dir / config.client_cert}"
            f"&sslkey={cert_dir / config.client_key}"
        )
        base_url, connect_args = get_pg_config(url, "psycopg")
        engine = create_async_engine(base_url, connect_args=connect_args)
        async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        async with async_session() as session:
            result = await session.execute(text("SELECT version()"))
            version = result.scalar()
            print(f"Connected successfully to: {version}")
        await engine.dispose()
    except Exception as e:
        print(f"Connection error: {e}")
        raise


async def test_connection_asyncpg_dsn(dsn: str) -> None:
    """Test SSL/TLS connection using asyncpg with DSN.

    Args:
        dsn: Connection string in psycopg format:
            postgresql://user@host:port/database?sslmode=verify-full&sslrootcert=path&sslcert=path&sslkey=path

    Raises:
        Exception: If connection fails or SSL/TLS verification fails
    """
    print("\n=== Testing with asyncpg (DSN) ===")
    print(f"Input DSN: {dsn}")

    try:
        url = make_url(dsn)
        base_url, connect_args = get_pg_config(url, "asyncpg")
        # Convert SQLAlchemy URL to standard PostgreSQL connection string
        dsn = base_url.set(drivername="postgresql").render_as_string(hide_password=False)
        print(f"Base URL: {dsn}")
        print(f"Connect Args: {connect_args}")

        print("\nAttempting connection with asyncpg...")
        conn = await asyncpg.connect(dsn, **connect_args)
        version = await conn.fetchval("SELECT version()")
        print(f"✅ Connected successfully to: {version}")
        await conn.close()
    except Exception as e:
        print(f"❌ Connection error: {e}")
        raise


async def test_connection_psycopg_dsn(dsn: str) -> None:
    """Test SSL/TLS connection using psycopg with DSN.

    Args:
        dsn: Connection string in psycopg format:
            postgresql://user@host:port/database?sslmode=verify-full&sslrootcert=path&sslcert=path&sslkey=path

    Raises:
        Exception: If connection fails or SSL/TLS verification fails
    """
    print("\n=== Testing with psycopg (DSN) ===")
    print(f"Input DSN: {dsn}")

    try:
        url = make_url(dsn)
        base_url, connect_args = get_pg_config(url, "psycopg")
        # Convert SQLAlchemy URL to standard PostgreSQL connection string
        dsn = base_url.set(drivername="postgresql").render_as_string(hide_password=False)
        print(f"Base URL: {dsn}")
        print(f"Connect Args: {connect_args}")

        print("\nAttempting connection with psycopg...")
        conn = await psycopg.AsyncConnection.connect(dsn, **connect_args)
        async with conn.cursor() as cur:
            await cur.execute("SELECT version()")
            version = (await cur.fetchone())[0]
        print(f"✅ Connected successfully to: {version}")
        await conn.close()
    except Exception as e:
        print(f"❌ Connection error: {e}")
        raise


async def test_connection_sqlalchemy_asyncpg_dsn(dsn: str) -> None:
    """Test SSL/TLS connection using SQLAlchemy with asyncpg and DSN.

    Args:
        dsn: Connection string in psycopg format:
            postgresql://user@host:port/database?sslmode=verify-full&sslrootcert=path&sslcert=path&sslkey=path

    Raises:
        Exception: If connection fails or SSL/TLS verification fails
    """
    print("\n=== Testing with SQLAlchemy 2.0 (asyncpg DSN) ===")
    print(f"Input DSN: {dsn}")

    try:
        url = make_url(dsn)
        base_url, connect_args = get_pg_config(url, "asyncpg")
        print(f"Base URL: {base_url}")
        print(f"Connect Args: {connect_args}")

        print("\nCreating SQLAlchemy engine...")
        engine = create_async_engine(base_url, connect_args=connect_args)
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
        dsn: Connection string in psycopg format:
            postgresql://user@host:port/database?sslmode=verify-full&sslrootcert=path&sslcert=path&sslkey=path

    Raises:
        Exception: If connection fails or SSL/TLS verification fails
    """
    print("\n=== Testing with SQLAlchemy 2.0 (psycopg DSN) ===")
    print(f"Input DSN: {dsn}")

    try:
        url = make_url(dsn)
        base_url, connect_args = get_pg_config(url, "psycopg")
        print(f"Base URL: {base_url}")
        print(f"Connect Args: {connect_args}")

        print("\nCreating SQLAlchemy engine...")
        engine = create_async_engine(base_url, connect_args=connect_args)
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

    print("\nDSN-based connections:")
    print(f"  {'✅' if results.asyncpg_dsn else '❌'} asyncpg")
    print(f"  {'✅' if results.psycopg_dsn else '❌'} psycopg")
    print(f"  {'✅' if results.sqlalchemy_asyncpg_dsn else '❌'} SQLAlchemy (asyncpg)")
    print(f"  {'✅' if results.sqlalchemy_psycopg_dsn else '❌'} SQLAlchemy (psycopg)")


async def main() -> None:
    """Run connection tests for all drivers and display results."""
    print(f"Working directory: {Path.cwd()}")
    config = DatabaseConfig()
    test_results = TestResults(
        asyncpg_config=False,
        psycopg_config=False,
        sqlalchemy_asyncpg_config=False,
        sqlalchemy_psycopg_config=False,
        asyncpg_dsn=False,
        psycopg_dsn=False,
        sqlalchemy_asyncpg_dsn=False,
        sqlalchemy_psycopg_dsn=False,
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

    # Test with DSN
    cert_dir = Path(config.cert_dir)
    dsn = (
        f"postgresql://{config.user}@{config.host}:{config.port}/{config.database}"
        f"?sslmode=verify-full"
        f"&sslrootcert={cert_dir / config.root_cert}"
        f"&sslcert={cert_dir / config.client_cert}"
        f"&sslkey={cert_dir / config.client_key}"
    )

    try:
        await test_connection_asyncpg_dsn(dsn)
        test_results.asyncpg_dsn = True
    except Exception as e:
        print(f"\n❌ asyncpg DSN test failed: {e}")

    try:
        await test_connection_psycopg_dsn(dsn)
        test_results.psycopg_dsn = True
    except Exception as e:
        print(f"\n❌ psycopg DSN test failed: {e}")

    try:
        await test_connection_sqlalchemy_asyncpg_dsn(dsn)
        test_results.sqlalchemy_asyncpg_dsn = True
    except Exception as e:
        print(f"\n❌ SQLAlchemy asyncpg DSN test failed: {e}")

    try:
        await test_connection_sqlalchemy_psycopg_dsn(dsn)
        test_results.sqlalchemy_psycopg_dsn = True
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

    # Print connection string with absolute paths
    print("\n========== Connection String ==========")
    print("Use this connection string to connect with SSL/TLS:")
    print(
        f"postgresql://{config.user}@{config.host}:{config.port}/{config.database}"
        f"?sslmode=verify-full"
        f"&sslrootcert={cert_dir / config.root_cert}"
        f"&sslcert={cert_dir / config.client_cert}"
        f"&sslkey={cert_dir / config.client_key}"
    )


if __name__ == "__main__":
    asyncio.run(main())
