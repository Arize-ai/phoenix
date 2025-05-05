from __future__ import annotations

import asyncio
import json
import logging
import ssl
from collections.abc import Callable
from datetime import datetime
from enum import Enum
from sqlite3 import Connection
from typing import Any, Literal, Mapping, TypedDict

import aiosqlite
import numpy as np
import sqlalchemy
import sqlean
from sqlalchemy import URL, StaticPool, event, make_url
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from typing_extensions import assert_never

from phoenix.config import LoggingMode, get_env_database_schema
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.migrate import migrate_in_thread
from phoenix.db.models import init_models
from phoenix.settings import Settings

sqlean.extensions.enable("text", "stats")

logger = logging.getLogger(__name__)


def set_sqlite_pragma(connection: Connection, _: Any) -> None:
    cursor = connection.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")
    cursor.execute("PRAGMA journal_mode = WAL;")
    cursor.execute("PRAGMA synchronous = OFF;")
    cursor.execute("PRAGMA cache_size = -32000;")
    cursor.execute("PRAGMA busy_timeout = 10000;")
    cursor.close()


def get_printable_db_url(connection_str: str) -> str:
    return make_url(connection_str).render_as_string(hide_password=True)


def get_async_db_url(connection_str: str) -> URL:
    """
    Parses the database URL string and returns a URL object that is async
    """
    url = make_url(connection_str)
    if not url.database:
        raise ValueError("Failed to parse database from connection string")
    backend = SupportedSQLDialect(url.get_backend_name())
    if backend is SupportedSQLDialect.SQLITE:
        return url.set(drivername="sqlite+aiosqlite")
    elif backend is SupportedSQLDialect.POSTGRESQL:
        url = url.set(drivername="postgresql+asyncpg")
        # For some reason username and password cannot be parsed from the typical slot
        # So we need to parse them out manually
        if url.username and url.password:
            url = url.set(
                query={**url.query, "user": url.username, "password": url.password},
                password=None,
                username=None,
            )
        return url
    else:
        assert_never(backend)


def create_engine(
    connection_str: str,
    migrate: bool = not Settings.disable_migrations,
    log_to_stdout: bool = False,
) -> AsyncEngine:
    """
    Factory to create a SQLAlchemy engine from a URL string.
    """
    url = make_url(connection_str)
    if not url.database:
        raise ValueError("Failed to parse database from connection string")
    backend = SupportedSQLDialect(url.get_backend_name())
    url = get_async_db_url(url.render_as_string(hide_password=False))
    # If Phoenix is run as an application, we want to pass log_migrations_to_stdout=False
    # and let the configured sqlalchemy logger handle the migration logs
    log_migrations_to_stdout = (
        Settings.log_migrations and Settings.logging_mode != LoggingMode.STRUCTURED
    )
    if backend is SupportedSQLDialect.SQLITE:
        return aio_sqlite_engine(
            url=url,
            migrate=migrate,
            log_to_stdout=log_to_stdout,
            log_migrations_to_stdout=log_migrations_to_stdout,
        )
    elif backend is SupportedSQLDialect.POSTGRESQL:
        return aio_postgresql_engine(
            url=url,
            migrate=migrate,
            log_to_stdout=log_to_stdout,
            log_migrations_to_stdout=log_migrations_to_stdout,
        )
    else:
        assert_never(backend)


def aio_sqlite_engine(
    url: URL,
    migrate: bool = True,
    shared_cache: bool = True,
    log_to_stdout: bool = False,
    log_migrations_to_stdout: bool = True,
) -> AsyncEngine:
    database = url.database or ":memory:"
    if database.startswith("file:"):
        database = database[5:]
    if database.startswith(":memory:") and shared_cache:
        url = url.set(query={**url.query, "cache": "shared"}, database=":memory:")
    database = url.render_as_string().partition("///")[-1]

    def async_creator() -> aiosqlite.Connection:
        conn = aiosqlite.Connection(
            lambda: sqlean.connect(f"file:{database}", uri=True),
            iter_chunk_size=64,
        )
        conn.daemon = True
        return conn

    engine = create_async_engine(
        url=url,
        echo=log_to_stdout,
        json_serializer=_dumps,
        async_creator=async_creator,
        poolclass=StaticPool,
    )
    event.listen(engine.sync_engine, "connect", set_sqlite_pragma)
    if not migrate:
        return engine
    if database.startswith(":memory:"):
        try:
            asyncio.get_running_loop()
        except RuntimeError:
            asyncio.run(init_models(engine))
        else:
            asyncio.create_task(init_models(engine))
    else:
        sync_engine = sqlalchemy.create_engine(
            url=url.set(drivername="sqlite"),
            echo=log_migrations_to_stdout,
            json_serializer=_dumps,
            creator=lambda: sqlean.connect(f"file:{database}", uri=True),
        )
        migrate_in_thread(sync_engine)
    return engine


def set_postgresql_search_path(schema: str) -> Callable[[Connection, Any], None]:
    def _(connection: Connection, _: Any) -> None:
        cursor = connection.cursor()
        cursor.execute(f"CREATE SCHEMA IF NOT EXISTS {schema};")
        cursor.execute(f"SET search_path TO {schema};")

    return _


def aio_postgresql_engine(
    url: URL,
    migrate: bool = True,
    log_to_stdout: bool = False,
    log_migrations_to_stdout: bool = True,
) -> AsyncEngine:
    # Create async engine with appropriate SSL configuration
    base_url, connect_args = _get_sqlalchemy_config(url, "asyncpg")
    engine = create_async_engine(
        url=base_url,
        connect_args=connect_args,
        echo=log_to_stdout,
        json_serializer=_dumps,
    )
    if not migrate:
        return engine

    # Create sync engine with appropriate SSL configuration
    base_url, connect_args = _get_sqlalchemy_config(url, "psycopg")
    sync_engine = sqlalchemy.create_engine(
        url=base_url,
        connect_args=connect_args,
        echo=log_migrations_to_stdout,
        json_serializer=_dumps,
    )
    if schema := get_env_database_schema():
        event.listen(sync_engine, "connect", set_postgresql_search_path(schema))
    migrate_in_thread(sync_engine)
    return engine


def _dumps(obj: Any) -> str:
    return json.dumps(obj, cls=_Encoder)


class _Encoder(json.JSONEncoder):
    def default(self, obj: Any) -> Any:
        if isinstance(obj, datetime):
            return obj.isoformat()
        elif isinstance(obj, Enum):
            return obj.value
        elif isinstance(obj, np.ndarray):
            return list(obj)
        elif isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        return super().default(obj)


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
    """  # noqa: E501

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
    """  # noqa: E501

    sslmode: str
    sslrootcert: str
    sslcert: str
    sslkey: str


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


def _get_ssl_context(raw_ssl_params: _RawSSLParams) -> ssl.SSLContext:
    """Create an SSL context from raw SSL parameters.

    Args:
        raw_ssl_params: Raw SSL parameters from URL query

    Returns:
        Configured SSL context with:
        - Root CA certificate for server verification (if provided)
        - Client certificate and key for mutual TLS (if provided)
        - SSL mode appropriate verification settings

    Note:
        The SSL parameters are in raw format from the URL query, supporting both
        psycopg and asyncpg parameter formats.

        SSL Modes (from PostgreSQL documentation):
        - disable: No SSL
        - allow: Try non-SSL first, then SSL
        - prefer: Try SSL first, then non-SSL
        - require: SSL connection required, no certificate verification
        - verify-ca: SSL connection required, verify server certificate against CA
        - verify-full: SSL connection required, verify server certificate and hostname

        For modes that require verification (verify-ca, verify-full):
        - Server certificate is verified against the provided CA certificate
        - For verify-full, hostname is also verified
        - Client certificates are used if provided

        For modes that don't require verification (require, prefer, allow, disable):
        - No certificate verification is performed
        - Client certificates are still loaded if provided
        - The connection is still encrypted
        - System CA certificates are loaded by default

        Client Certificates:
        - Can be provided regardless of SSL mode
        - Server must be configured to request them (via pg_hba.conf)
        - Not part of SSL mode configuration
        - Both certificate and key files must be provided if either is present

        Security Considerations:
        - verify-full provides the highest level of security
        - verify-ca is suitable when hostname verification is not needed
        - require/prefer modes provide encryption without verification
        - disable/allow modes should only be used in trusted networks
    """  # noqa: E501
    # Create SSL context
    ssl_context = ssl.create_default_context()

    # Load CA certificate if provided
    ca_file = raw_ssl_params.get("sslrootcert") or raw_ssl_params.get("ssl_ca_certs_file")
    if ca_file is not None:
        ssl_context.load_verify_locations(cafile=ca_file)

    # Load client certificates if provided
    certfile = raw_ssl_params.get("sslcert") or raw_ssl_params.get("ssl_cert_file")
    keyfile = raw_ssl_params.get("sslkey") or raw_ssl_params.get("ssl_key_file")
    if certfile is not None and keyfile is not None:
        ssl_context.load_cert_chain(certfile=certfile, keyfile=keyfile)

    # Set verification mode based on sslmode if provided
    if sslmode := raw_ssl_params.get("sslmode"):
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
       - For asyncpg: SSL context object (only if SSL parameters are provided)
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

    Note:
        SSL Configuration:
        - For psycopg: SSL parameters are passed directly to the driver
        - For asyncpg: SSL context is created and configured based on parameters
        - Both drivers support all PostgreSQL SSL modes
        - Certificate paths are resolved relative to the current working directory

        Driver Compatibility:
        - psycopg: Uses native SSL parameters (sslmode, sslrootcert, etc.)
        - asyncpg: Uses SSL context with configured certificates
        - Mixed format parameters are supported (e.g., psycopg format with asyncpg driver)

        Security Considerations:
        - SSL is only enabled when parameters are explicitly provided
        - Certificate paths should be absolute or relative to working directory
        - System CA certificates are loaded by default for non-verify modes
    """  # noqa: E501
    # Create new URL with appropriate driver
    query, raw_ssl_params = _split_ssl_params(url.query or {})
    base_url = url.set(drivername=f"postgresql+{driver}", query=query)

    # Get appropriate SSL configuration based on driver
    if driver == "psycopg":
        # Convert _PsycopgConnectArgs to dict[str, Any]
        connect_args = dict(_get_psycopg_connect_args(raw_ssl_params))
        # Remove asyncpg-specific parameters for psycopg
        base_url = base_url.set(query=_remove_asyncpg_params(query))
    else:  # asyncpg
        # Only include SSL context if SSL parameters are provided
        connect_args = {}
        if any(raw_ssl_params.values()):
            connect_args["ssl"] = _get_ssl_context(raw_ssl_params)

    return base_url, connect_args


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
        - sslmode: SSL mode from raw_ssl_params (if provided)
        - sslrootcert: Path to root CA certificate (if provided)
        - sslcert: Path to client certificate (if provided)
        - sslkey: Path to client private key (if provided)

    Examples:
        >>> raw_ssl_params = {}
        >>> _get_psycopg_connect_args(raw_ssl_params)
        {}

        >>> raw_ssl_params = {"sslrootcert": "ca.crt", "sslcert": "client.crt", "sslkey": "client.key"}
        >>> _get_psycopg_connect_args(raw_ssl_params)
        {"sslrootcert": "ca.crt", "sslcert": "client.crt", "sslkey": "client.key"}

        >>> raw_ssl_params = {"sslrootcert": "ca.crt"}
        >>> _get_psycopg_connect_args(raw_ssl_params)
        {"sslrootcert": "ca.crt"}

        >>> raw_ssl_params = {"sslmode": "require", "sslrootcert": "ca.crt"}
        >>> _get_psycopg_connect_args(raw_ssl_params)
        {"sslmode": "require", "sslrootcert": "ca.crt"}
    """  # noqa: E501
    result: _PsycopgConnectArgs = {}

    # Only include SSL parameters if any are provided
    if not any(raw_ssl_params.values()):
        return result

    # Set sslmode if provided
    if sslmode := raw_ssl_params.get("sslmode"):
        result["sslmode"] = sslmode

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
