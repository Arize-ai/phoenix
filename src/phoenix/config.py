from __future__ import annotations

import logging
import os
import re
import tempfile
from dataclasses import dataclass, field
from datetime import timedelta
from enum import Enum
from importlib.metadata import version
from pathlib import Path
from typing import TYPE_CHECKING, Any, NamedTuple, Optional, Union, cast, overload
from urllib.parse import quote_plus, urljoin, urlparse

import wrapt
from email_validator import EmailNotValidError, validate_email
from starlette.datastructures import URL, Secret

from phoenix.utilities.logging import log_a_list
from phoenix.utilities.re import parse_env_headers

if TYPE_CHECKING:
    from phoenix.server.oauth2 import OAuth2Clients

logger = logging.getLogger(__name__)

# Phoenix environment variables
ENV_PHOENIX_PORT = "PHOENIX_PORT"
ENV_PHOENIX_GRPC_PORT = "PHOENIX_GRPC_PORT"
ENV_PHOENIX_HOST = "PHOENIX_HOST"
ENV_PHOENIX_HOST_ROOT_PATH = "PHOENIX_HOST_ROOT_PATH"
ENV_NOTEBOOK_ENV = "PHOENIX_NOTEBOOK_ENV"
ENV_PHOENIX_CLIENT_HEADERS = "PHOENIX_CLIENT_HEADERS"
"""
The headers to include in Phoenix client requests.
Note: This overrides OTEL_EXPORTER_OTLP_HEADERS in the case where
phoenix.trace instrumentors are used.
"""
ENV_PHOENIX_COLLECTOR_ENDPOINT = "PHOENIX_COLLECTOR_ENDPOINT"
"""
The endpoint traces and evals are sent to. This must be set if the Phoenix
server is running on a remote instance.
"""
ENV_PHOENIX_WORKING_DIR = "PHOENIX_WORKING_DIR"
"""
The directory in which to save, load, and export datasets. This directory must
be accessible by both the Phoenix server and the notebook environment.
"""
ENV_PHOENIX_PROJECT_NAME = "PHOENIX_PROJECT_NAME"
"""
The project name to use when logging traces and evals. defaults to 'default'.
"""
ENV_PHOENIX_SQL_DATABASE_URL = "PHOENIX_SQL_DATABASE_URL"
"""
The SQL database URL to use when logging traces and evals.
By default, Phoenix uses an SQLite database and stores it in the working directory.

Phoenix supports two types of database URLs:
- SQLite: 'sqlite:///path/to/database.db'
- PostgreSQL: 'postgresql://@host/dbname?user=user&password=password' or 'postgresql://user:password@host/dbname'

Note that if you plan on using SQLite, it's advised to to use a persistent volume
and simply point the PHOENIX_WORKING_DIR to that volume.
"""
ENV_PHOENIX_POSTGRES_HOST = "PHOENIX_POSTGRES_HOST"
"""
As an alternative to setting PHOENIX_SQL_DATABASE_URL, you can set the following
environment variables to connect to a PostgreSQL database:
- PHOENIX_POSTGRES_HOST
- PHOENIX_POSTGRES_PORT
- PHOENIX_POSTGRES_USER
- PHOENIX_POSTGRES_PASSWORD
- PHOENIX_POSTGRES_DB
"""
ENV_PHOENIX_POSTGRES_PORT = "PHOENIX_POSTGRES_PORT"
"""
Used with PHOENIX_POSTGRES_HOST to specify the port to use for the PostgreSQL database.
"""
ENV_PHOENIX_POSTGRES_USER = "PHOENIX_POSTGRES_USER"
"""
Used with PHOENIX_POSTGRES_HOST to specify the user to use for the PostgreSQL database (required).
"""
ENV_PHOENIX_POSTGRES_PASSWORD = "PHOENIX_POSTGRES_PASSWORD"
"""
Used with PHOENIX_POSTGRES_HOST to specify the password to use for the PostgreSQL database
(required).
"""
ENV_PHOENIX_POSTGRES_DB = "PHOENIX_POSTGRES_DB"
"""
Used with PHOENIX_POSTGRES_HOST to specify the database to use for the PostgreSQL database.
"""
ENV_PHOENIX_SQL_DATABASE_SCHEMA = "PHOENIX_SQL_DATABASE_SCHEMA"
"""
The schema to use for the PostgresSQL database. (This is ignored for SQLite.)
See e.g. https://www.postgresql.org/docs/current/ddl-schemas.html
"""
ENV_PHOENIX_DATABASE_ALLOCATED_STORAGE_CAPACITY_GIBIBYTES = (
    "PHOENIX_DATABASE_ALLOCATED_STORAGE_CAPACITY_GIBIBYTES"
)
"""
The allocated storage capacity for the Phoenix database in gibibytes (2^30 bytes). Use float for
fractional value. This is currently used only by the UI for informational displays.
"""
ENV_PHOENIX_ENABLE_PROMETHEUS = "PHOENIX_ENABLE_PROMETHEUS"
"""
Whether to enable Prometheus. Defaults to false.
"""
ENV_LOGGING_MODE = "PHOENIX_LOGGING_MODE"
"""
The logging mode (either 'default' or 'structured').
"""
ENV_LOGGING_LEVEL = "PHOENIX_LOGGING_LEVEL"
"""
The logging level ('debug', 'info', 'warning', 'error', 'critical') for the Phoenix backend. For
database logging see ENV_DB_LOGGING_LEVEL. Defaults to info.
"""
ENV_DB_LOGGING_LEVEL = "PHOENIX_DB_LOGGING_LEVEL"
"""
The logging level ('debug', 'info', 'warning', 'error', 'critical') for the Phoenix ORM.
Defaults to warning.
"""
ENV_LOG_MIGRATIONS = "PHOENIX_LOG_MIGRATIONS"
"""
Whether or not to log migrations. Defaults to true.
"""

ENV_PHOENIX_DANGEROUSLY_DISABLE_MIGRATIONS = "PHOENIX_DANGEROUSLY_DISABLE_MIGRATIONS"
"""
Whether or not to disable migrations. Defaults to None / False.

This should only be used by developers working on the Phoenix server that need to be
switching between branches without having to run migrations.
"""

# Phoenix server OpenTelemetry instrumentation environment variables
ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT = (
    "PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT"
)
ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_GRPC_ENDPOINT = (
    "PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_GRPC_ENDPOINT"
)

# Authentication settings
ENV_PHOENIX_ENABLE_AUTH = "PHOENIX_ENABLE_AUTH"
ENV_PHOENIX_DISABLE_BASIC_AUTH = "PHOENIX_DISABLE_BASIC_AUTH"
"""
Forbid login via password and disable the creation of local users, which log in via passwords.
This can be helpful in setups where authentication is handled entirely through OAUTH2.
"""
ENV_PHOENIX_DISABLE_RATE_LIMIT = "PHOENIX_DISABLE_RATE_LIMIT"
ENV_PHOENIX_SECRET = "PHOENIX_SECRET"
"""
The secret key used for signing JWTs. It must be at least 32 characters long and include at least
one digit and one lowercase letter.
"""
ENV_PHOENIX_ADMIN_SECRET = "PHOENIX_ADMIN_SECRET"
"""
A secret key that can be used as a bearer token instead of an API key. It authenticates as the
first system user. This key must be at least 32 characters long, include at least one digit and
one lowercase letter, and must be different from PHOENIX_SECRET. Additionally, it must not be set
if PHOENIX_SECRET is not configured.
"""
ENV_PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD = "PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD"
"""
The initial password for the default admin account, which defaults to 'admin' if not
explicitly set. Note that changing this value will have no effect if the default admin
record already exists in the database. In such cases, the default admin password must
be updated manually in the application.
"""
ENV_PHOENIX_API_KEY = "PHOENIX_API_KEY"
ENV_PHOENIX_USE_SECURE_COOKIES = "PHOENIX_USE_SECURE_COOKIES"
ENV_PHOENIX_COOKIES_PATH = "PHOENIX_COOKIES_PATH"
ENV_PHOENIX_ACCESS_TOKEN_EXPIRY_MINUTES = "PHOENIX_ACCESS_TOKEN_EXPIRY_MINUTES"
"""
The duration, in minutes, before access tokens expire.
"""
ENV_PHOENIX_REFRESH_TOKEN_EXPIRY_MINUTES = "PHOENIX_REFRESH_TOKEN_EXPIRY_MINUTES"
"""
The duration, in minutes, before refresh tokens expire.
"""
ENV_PHOENIX_PASSWORD_RESET_TOKEN_EXPIRY_MINUTES = "PHOENIX_PASSWORD_RESET_TOKEN_EXPIRY_MINUTES"
"""
The duration, in minutes, before password reset tokens expire.
"""
ENV_PHOENIX_CSRF_TRUSTED_ORIGINS = "PHOENIX_CSRF_TRUSTED_ORIGINS"
"""
A comma-separated list of origins allowed to bypass Cross-Site Request Forgery (CSRF)
protection. This setting is recommended when configuring OAuth2 clients or sending
password reset emails. If this variable is left unspecified or contains no origins, CSRF
protection will not be enabled. In such cases, when a request includes `origin` or `referer`
headers, those values will not be validated.
"""
ENV_PHOENIX_ADMINS = "PHOENIX_ADMINS"
"""
A semicolon-separated list of username and email address pairs to create as admin users on startup.
The format is `username=email`, e.g., `John Doe=john@example.com;Doe, Jane=jane@example.com`.
The password for each user will be randomly generated and will need to be reset. The application
will not start if this environment variable is set but cannot be parsed or contains invalid emails.
If the username or email address already exists in the database, the user record will not be
modified, e.g., changed from non-admin to admin. Changing this environment variable for the next
startup will not undo any records created in previous startups.
"""
ENV_PHOENIX_ROOT_URL = "PHOENIX_ROOT_URL"
"""
This is the full URL used to access Phoenix from a web browser. This setting is important when
you have a reverse proxy in front of Phoenix. If the reverse proxy exposes Phoenix through a
sub-path, add that sub-path to the end of this URL setting.

WARNING: When a sub-path is needed, you must also specify the sub-path via the environment
variable PHOENIX_HOST_ROOT_PATH. Setting just this URL setting is not enough.

Examples:
    - With a sub-path: "https://example.com/phoenix"
    - Without a sub-path: "https://phoenix.example.com"
"""


# SMTP settings
ENV_PHOENIX_SMTP_HOSTNAME = "PHOENIX_SMTP_HOSTNAME"
"""
The SMTP server hostname to use for sending emails. SMTP is disabled if this is not set.
"""
ENV_PHOENIX_SMTP_PORT = "PHOENIX_SMTP_PORT"
"""
The SMTP server port to use for sending emails. Defaults to 587.
"""
ENV_PHOENIX_SMTP_USERNAME = "PHOENIX_SMTP_USERNAME"
"""
The SMTP server username to use for sending emails. Should be set if SMTP is enabled.
"""
ENV_PHOENIX_SMTP_PASSWORD = "PHOENIX_SMTP_PASSWORD"
"""
The SMTP server password to use for sending emails. Should be set if SMTP is enabled.
"""
ENV_PHOENIX_SMTP_MAIL_FROM = "PHOENIX_SMTP_MAIL_FROM"
"""
The email address to use as the sender when sending emails. Should be set if SMTP is enabled.
"""
ENV_PHOENIX_SMTP_VALIDATE_CERTS = "PHOENIX_SMTP_VALIDATE_CERTS"
"""
Whether to validate SMTP server certificates. Defaults to true.
"""
ENV_PHOENIX_ALLOWED_ORIGINS = "PHOENIX_ALLOWED_ORIGINS"
"""
List of allowed origins for CORS. Defaults to None.
When set to None, CORS is disabled.
"""
# API extension settings
ENV_PHOENIX_FASTAPI_MIDDLEWARE_PATHS = "PHOENIX_FASTAPI_MIDDLEWARE_PATHS"
ENV_PHOENIX_GQL_EXTENSION_PATHS = "PHOENIX_GQL_EXTENSION_PATHS"
ENV_PHOENIX_GRPC_INTERCEPTOR_PATHS = "PHOENIX_GRPC_INTERCEPTOR_PATHS"

ENV_PHOENIX_TLS_ENABLED = "PHOENIX_TLS_ENABLED"
"""
Whether to enable TLS for Phoenix HTTP and gRPC servers.
"""
ENV_PHOENIX_TLS_ENABLED_FOR_HTTP = "PHOENIX_TLS_ENABLED_FOR_HTTP"
"""
Whether to enable TLS for Phoenix HTTP server. Overrides PHOENIX_TLS_ENABLED.
"""
ENV_PHOENIX_TLS_ENABLED_FOR_GRPC = "PHOENIX_TLS_ENABLED_FOR_GRPC"
"""
Whether to enable TLS for Phoenix gRPC server. Overrides PHOENIX_TLS_ENABLED.
"""
ENV_PHOENIX_TLS_CERT_FILE = "PHOENIX_TLS_CERT_FILE"
"""
Path to the TLS certificate file for HTTPS connections.
When set, Phoenix will use HTTPS instead of HTTP for all connections.
"""
ENV_PHOENIX_TLS_KEY_FILE = "PHOENIX_TLS_KEY_FILE"
"""
Path to the TLS private key file for HTTPS connections.
Required when PHOENIX_TLS_CERT_FILE is set.
"""
ENV_PHOENIX_TLS_KEY_FILE_PASSWORD = "PHOENIX_TLS_KEY_FILE_PASSWORD"
"""
Password for the TLS private key file if it's encrypted.
Only needed if the private key file requires a password.
"""
ENV_PHOENIX_TLS_CA_FILE = "PHOENIX_TLS_CA_FILE"
"""
Path to the Certificate Authority (CA) file for client certificate verification.
Used when PHOENIX_TLS_VERIFY_CLIENT is set to true.
"""
ENV_PHOENIX_TLS_VERIFY_CLIENT = "PHOENIX_TLS_VERIFY_CLIENT"
"""
Whether to verify client certificates for mutual TLS (mTLS) authentication.
When set to true, clients must provide valid certificates signed by the CA specified in
PHOENIX_TLS_CA_FILE.
"""


@dataclass(frozen=True)
class TLSConfig:
    """Configuration for TLS (Transport Layer Security) connections.

    This class manages TLS certificates and private keys for secure connections.
    It handles reading certificate and key files, and decrypting private keys
    if they are password-protected.

    Attributes:
        cert_file: Path to the TLS certificate file
        key_file: Path to the TLS private key file
        key_file_password: Optional password for decrypting the private key
        _cert_data: Cached certificate data (internal use)
        _key_data: Cached decrypted key data (internal use)
        _decrypted_key_data: Cached decrypted key data (internal use)
    """

    cert_file: Path
    key_file: Path
    key_file_password: Optional[str]
    _cert_data: bytes = field(default=b"", init=False, repr=False)
    _key_data: bytes = field(default=b"", init=False, repr=False)
    _decrypted_key_data: Optional[bytes] = field(default=None, init=False, repr=False)

    @property
    def cert_data(self) -> bytes:
        """Get the certificate data, reading from file if not cached.

        Returns:
            bytes: The certificate data in PEM format
        """
        if not self._cert_data:
            with open(self.cert_file, "rb") as f:
                object.__setattr__(self, "_cert_data", f.read())
        return self._cert_data

    @property
    def key_data(self) -> bytes:
        """Get the decrypted key data, reading from file if not cached.

        This property reads the private key file and decrypts it if a password
        is provided. The decrypted key is cached for subsequent accesses.

        Returns:
            bytes: The decrypted private key data in PEM format

        Raises:
            ValueError: If the cryptography library is not installed or if
                decryption fails
        """
        if not self._key_data:
            self._read_and_cache_key_data()
        return self._key_data

    def _read_and_cache_key_data(self) -> None:
        """Read and decrypt the private key file, then cache the result.

        This method reads the private key file, decrypts it if a password
        is provided, and stores the decrypted key in the _key_data attribute.

        Raises:
            ValueError: If the cryptography library is not installed or if
                decryption fails
        """
        try:
            from cryptography.hazmat.backends import default_backend
            from cryptography.hazmat.primitives.serialization import (
                Encoding,
                NoEncryption,
                PrivateFormat,
                load_pem_private_key,
            )
        except ImportError:
            raise ValueError(
                "The cryptography library is needed to read private keys for "
                "TLS configuration. Please install it with: pip install cryptography"
            )

        # First read the key file
        with open(self.key_file, "rb") as f:
            key_data = f.read()

        try:
            # Convert password to bytes if it exists
            password_bytes = self.key_file_password.encode() if self.key_file_password else None

            # Load the key (decrypting if password is provided)
            private_key = load_pem_private_key(
                key_data,
                password=password_bytes,
                backend=default_backend(),
            )

            # Convert to PEM format without encryption
            decrypted_pem = private_key.private_bytes(
                encoding=Encoding.PEM,
                format=PrivateFormat.PKCS8,
                encryption_algorithm=NoEncryption(),
            )
        except Exception as e:
            raise ValueError(f"Failed to decrypt private key: {e}")
        object.__setattr__(self, "_key_data", decrypted_pem)


@dataclass(frozen=True)
class TLSConfigVerifyClient(TLSConfig):
    """TLS configuration with client verification enabled."""

    ca_file: Path
    _ca_data: bytes = field(default=b"", init=False, repr=False)

    @property
    def ca_data(self) -> bytes:
        """Get the CA certificate data, reading from file if not cached."""
        if not self._ca_data:
            with open(self.ca_file, "rb") as f:
                object.__setattr__(self, "_ca_data", f.read())
        return self._ca_data


def get_env_tls_enabled_for_http() -> bool:
    """
    Gets whether TLS is enabled for the HTTP server.

    This function checks both PHOENIX_TLS_ENABLED_FOR_HTTP and PHOENIX_TLS_ENABLED environment variables.
    If PHOENIX_TLS_ENABLED_FOR_HTTP is set, it takes precedence over PHOENIX_TLS_ENABLED.

    Returns:
        bool: True if TLS is enabled for HTTP server, False otherwise. Defaults to False if neither
        environment variable is set.
    """  # noqa: E501
    return _bool_val(ENV_PHOENIX_TLS_ENABLED_FOR_HTTP, _bool_val(ENV_PHOENIX_TLS_ENABLED, False))


def get_env_tls_enabled_for_grpc() -> bool:
    """
    Gets whether TLS is enabled for the gRPC server.

    This function checks both PHOENIX_TLS_ENABLED_FOR_GRPC and PHOENIX_TLS_ENABLED environment variables.
    If PHOENIX_TLS_ENABLED_FOR_GRPC is set, it takes precedence over PHOENIX_TLS_ENABLED.

    Returns:
        bool: True if TLS is enabled for gRPC server, False otherwise. Defaults to False if neither
        environment variable is set.
    """  # noqa: E501
    return _bool_val(ENV_PHOENIX_TLS_ENABLED_FOR_GRPC, _bool_val(ENV_PHOENIX_TLS_ENABLED, False))


def get_env_tls_verify_client() -> bool:
    """
    Gets the value of the PHOENIX_TLS_VERIFY_CLIENT environment variable.

    Returns:
        bool: True if client certificate verification is enabled, False otherwise. Defaults to False
        if the environment variable is not set.
    """  # noqa: E501
    return _bool_val(ENV_PHOENIX_TLS_VERIFY_CLIENT, False)


def get_env_tls_config() -> Optional[TLSConfig]:
    """
    Retrieves and validates TLS configuration from environment variables.

    Returns:
        Optional[TLSConfig]: A configuration object containing TLS settings, or None if TLS is disabled.
        If client verification is enabled, returns TLSConfigVerifyClient instead.

    The function reads the following environment variables:
    - PHOENIX_TLS_ENABLED: Whether TLS is enabled (defaults to False)
    - PHOENIX_TLS_CERT_FILE: Path to the TLS certificate file
    - PHOENIX_TLS_KEY_FILE: Path to the TLS private key file
    - PHOENIX_TLS_KEY_FILE_PASSWORD: Password for the TLS private key file
    - PHOENIX_TLS_CA_FILE: Path to the Certificate Authority file (required for client verification)
    - PHOENIX_TLS_VERIFY_CLIENT: Whether to verify client certificates

    Raises:
        ValueError: If required files are missing or don't exist when TLS is enabled
    """  # noqa: E501
    # Check if TLS is enabled
    if not (get_env_tls_enabled_for_http() or get_env_tls_enabled_for_grpc()):
        return None

    # Get certificate file path if specified
    if not (cert_file_str := getenv(ENV_PHOENIX_TLS_CERT_FILE)):
        raise ValueError("PHOENIX_TLS_CERT_FILE must be set when PHOENIX_TLS_ENABLED is true")
    cert_file = Path(cert_file_str)

    # Get private key file path if specified
    if not (key_file_str := getenv(ENV_PHOENIX_TLS_KEY_FILE)):
        raise ValueError("PHOENIX_TLS_KEY_FILE must be set when PHOENIX_TLS_ENABLED is true")
    key_file = Path(key_file_str)

    # Get private key password if specified
    key_file_password = getenv(ENV_PHOENIX_TLS_KEY_FILE_PASSWORD)

    # Validate certificate and key files
    _validate_file_exists_and_is_readable(cert_file, "certificate")
    _validate_file_exists_and_is_readable(key_file, "key")

    # If client verification is enabled, validate CA file and return TLSConfigVerifyClient
    if get_env_tls_verify_client():
        if not (ca_file_str := getenv(ENV_PHOENIX_TLS_CA_FILE)):
            raise ValueError(
                "PHOENIX_TLS_CA_FILE must be set when PHOENIX_TLS_VERIFY_CLIENT is true"
            )

        ca_file = Path(ca_file_str)
        _validate_file_exists_and_is_readable(ca_file, "CA")

        return TLSConfigVerifyClient(
            cert_file=cert_file,
            key_file=key_file,
            key_file_password=key_file_password,
            ca_file=ca_file,
        )

    return TLSConfig(
        cert_file=cert_file,
        key_file=key_file,
        key_file_password=key_file_password,
    )


def server_instrumentation_is_enabled() -> bool:
    return bool(
        getenv(ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT)
    ) or bool(getenv(ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_GRPC_ENDPOINT))


def _get_temp_path() -> Path:
    """Get path to  directory in which to store temp phoenix server files."""
    return Path(tempfile.gettempdir()) / ".arize-phoenix"


def get_pids_path() -> Path:
    """Get path to directory in which to store temp phoenix instance pid files.
    This directory is used to track any currently running instances of Arize Phoenix
    on the host machine. The directory will be created if it does not exist.
    """
    path = _get_temp_path() / "pids"
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_running_pid() -> Optional[int]:
    for file in get_pids_path().iterdir():
        if file.name.isnumeric():
            return int(file.name)
    return None


def get_working_dir() -> Path:
    """
    Get the working directory for saving, loading, and exporting datasets.
    """
    working_dir_str = getenv(ENV_PHOENIX_WORKING_DIR)
    if working_dir_str is not None:
        return Path(working_dir_str)
    # Fall back to ~/.phoenix if PHOENIX_WORKING_DIR is not set
    return Path.home().resolve() / ".phoenix"


@overload
def _bool_val(env_var: str) -> Optional[bool]: ...
@overload
def _bool_val(env_var: str, default: bool) -> bool: ...
def _bool_val(env_var: str, default: Optional[bool] = None) -> Optional[bool]:
    """
    Parses a boolean environment variable, returning `default` if the variable is not set.
    """
    if (value := getenv(env_var)) is None:
        return default
    assert (lower := value.lower()) in (
        "true",
        "false",
    ), f"{env_var} must be set to TRUE or FALSE (case-insensitive). Got: {value}"
    return lower == "true"


@overload
def _float_val(env_var: str) -> Optional[float]: ...
@overload
def _float_val(env_var: str, default: float) -> float: ...
def _float_val(env_var: str, default: Optional[float] = None) -> Optional[float]:
    """
    Parses a numeric environment variable, returning `default` if the variable is not set.
    """
    if (value := getenv(env_var)) is None:
        return default
    try:
        return float(value)
    except ValueError:
        raise ValueError(
            f"Invalid value for environment variable {env_var}: {value}. Value must be a number."
        )


@overload
def _int_val(env_var: str) -> Optional[int]: ...
@overload
def _int_val(env_var: str, default: int) -> int: ...
def _int_val(env_var: str, default: Optional[int] = None) -> Optional[int]:
    """
    Parses a numeric environment variable, returning `default` if the variable is not set.
    """
    if (value := getenv(env_var)) is None:
        return default
    try:
        return int(value)
    except ValueError:
        raise ValueError(
            f"Invalid value for environment variable {env_var}: {value}. Value must be an integer."
        )


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


def get_env_enable_auth() -> bool:
    """
    Gets the value of the PHOENIX_ENABLE_AUTH environment variable.
    """
    return _bool_val(ENV_PHOENIX_ENABLE_AUTH, False)


def get_env_disable_basic_auth() -> bool:
    """
    Gets the value of the ENV_PHOENIX_DISABLE_BASIC_AUTH environment variable.
    """
    return _bool_val(ENV_PHOENIX_DISABLE_BASIC_AUTH, False)


def get_env_disable_rate_limit() -> bool:
    """
    Gets the value of the PHOENIX_DISABLE_RATE_LIMIT environment variable.
    """
    return _bool_val(ENV_PHOENIX_DISABLE_RATE_LIMIT, False)


def get_env_phoenix_secret() -> Secret:
    """
    Gets the value of the PHOENIX_SECRET environment variable
    and performs validation.
    """
    phoenix_secret = getenv(ENV_PHOENIX_SECRET)
    if phoenix_secret is None:
        return Secret("")
    from phoenix.auth import REQUIREMENTS_FOR_PHOENIX_SECRET

    REQUIREMENTS_FOR_PHOENIX_SECRET.validate(phoenix_secret, "Phoenix secret")
    return Secret(phoenix_secret)


def get_env_phoenix_admin_secret() -> Secret:
    """
    Gets the value of the PHOENIX_ADMIN_SECRET environment variable
    and performs validation.
    """
    phoenix_admin_secret = getenv(ENV_PHOENIX_ADMIN_SECRET)
    if phoenix_admin_secret is None:
        return Secret("")
    if not (phoenix_secret := get_env_phoenix_secret()):
        raise ValueError(
            f"`{ENV_PHOENIX_ADMIN_SECRET}` must be not be set without "
            f"setting `{ENV_PHOENIX_SECRET}`."
        )
    from phoenix.auth import REQUIREMENTS_FOR_PHOENIX_SECRET

    REQUIREMENTS_FOR_PHOENIX_SECRET.validate(phoenix_admin_secret, "Phoenix secret")
    if phoenix_admin_secret == str(phoenix_secret):
        raise ValueError(
            f"`{ENV_PHOENIX_ADMIN_SECRET}` must be different from `{ENV_PHOENIX_SECRET}`"
        )
    return Secret(phoenix_admin_secret)


def get_env_default_admin_initial_password() -> Secret:
    from phoenix.auth import DEFAULT_ADMIN_PASSWORD

    return Secret(getenv(ENV_PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD) or DEFAULT_ADMIN_PASSWORD)


def get_env_cookies_path() -> str:
    """
    Gets the value of the PHOENIX_COOKIE_PATH environment variable.
    """
    return getenv(ENV_PHOENIX_COOKIES_PATH, "/")


def get_env_phoenix_use_secure_cookies() -> bool:
    return _bool_val(ENV_PHOENIX_USE_SECURE_COOKIES, False)


def get_env_phoenix_api_key() -> Optional[str]:
    return getenv(ENV_PHOENIX_API_KEY)


class AuthSettings(NamedTuple):
    enable_auth: bool
    disable_basic_auth: bool
    phoenix_secret: Secret
    phoenix_admin_secret: Secret
    oauth2_clients: OAuth2Clients


def get_env_auth_settings() -> AuthSettings:
    """
    Gets auth settings and performs validation.
    """
    enable_auth = get_env_enable_auth()
    phoenix_secret = get_env_phoenix_secret()
    if enable_auth and not phoenix_secret:
        raise ValueError(
            f"`{ENV_PHOENIX_SECRET}` must be set when "
            f"auth is enabled with `{ENV_PHOENIX_ENABLE_AUTH}`"
        )
    phoenix_admin_secret = get_env_phoenix_admin_secret()
    disable_basic_auth = get_env_disable_basic_auth()
    from phoenix.server.oauth2 import OAuth2Clients

    oauth2_clients = OAuth2Clients.from_configs(get_env_oauth2_settings())
    if enable_auth and disable_basic_auth and not oauth2_clients:
        raise ValueError(
            "OAuth2 is the only supported auth method but no OAuth2 client configs are provided."
        )
    return AuthSettings(
        enable_auth=enable_auth,
        disable_basic_auth=disable_basic_auth,
        phoenix_secret=phoenix_secret,
        phoenix_admin_secret=phoenix_admin_secret,
        oauth2_clients=oauth2_clients,
    )


def get_env_password_reset_token_expiry() -> timedelta:
    """
    Gets the password reset token expiry.
    """
    from phoenix.auth import DEFAULT_PASSWORD_RESET_TOKEN_EXPIRY_MINUTES

    minutes = _float_val(
        ENV_PHOENIX_PASSWORD_RESET_TOKEN_EXPIRY_MINUTES,
        DEFAULT_PASSWORD_RESET_TOKEN_EXPIRY_MINUTES,
    )
    assert minutes > 0
    return timedelta(minutes=minutes)


def get_env_access_token_expiry() -> timedelta:
    """
    Gets the access token expiry.
    """
    from phoenix.auth import DEFAULT_ACCESS_TOKEN_EXPIRY_MINUTES

    minutes = _float_val(
        ENV_PHOENIX_ACCESS_TOKEN_EXPIRY_MINUTES,
        DEFAULT_ACCESS_TOKEN_EXPIRY_MINUTES,
    )
    assert minutes > 0
    return timedelta(minutes=minutes)


def get_env_refresh_token_expiry() -> timedelta:
    """
    Gets the refresh token expiry.
    """
    from phoenix.auth import DEFAULT_REFRESH_TOKEN_EXPIRY_MINUTES

    minutes = _float_val(
        ENV_PHOENIX_REFRESH_TOKEN_EXPIRY_MINUTES,
        DEFAULT_REFRESH_TOKEN_EXPIRY_MINUTES,
    )
    assert minutes > 0
    return timedelta(minutes=minutes)


def get_env_csrf_trusted_origins() -> list[str]:
    origins: list[str] = []
    if not (csrf_trusted_origins := getenv(ENV_PHOENIX_CSRF_TRUSTED_ORIGINS)):
        return origins
    for origin in csrf_trusted_origins.split(","):
        if not origin:
            continue
        if not urlparse(origin).hostname:
            raise ValueError(
                f"The environment variable `{ENV_PHOENIX_CSRF_TRUSTED_ORIGINS}` contains a url "
                f"with missing hostname. Please ensure that each url has a valid hostname."
            )
        origins.append(origin)
    return sorted(set(origins))


def get_env_admins() -> dict[str, str]:
    """
    Parse the PHOENIX_ADMINS environment variable to extract the comma separated pairs of
    username and email. The last equal sign (=) in each pair is used to separate the username from
    the email.

    Returns:
        dict: A dictionary mapping email addresses to usernames

    Raises:
        ValueError: If the environment variable cannot be parsed or contains invalid email addresses
    """
    if not (env_value := getenv(ENV_PHOENIX_ADMINS)):
        return {}
    usernames = set()
    emails = set()
    ans = {}
    for pair in env_value.split(";"):
        pair = pair.strip()
        if not pair:
            continue
        # Find the last equals sign to separate username from email
        # This allows usernames to contain equals signs
        last_equals_pos = pair.rfind("=")
        if last_equals_pos == -1:
            raise ValueError(
                f"Invalid format in {ENV_PHOENIX_ADMINS}: '{pair}'. "
                f"Expected format: 'username=email'"
            )
        username = pair[:last_equals_pos].strip()
        email_addr = pair[last_equals_pos + 1 :].strip()
        try:
            email_addr = validate_email(email_addr, check_deliverability=False).normalized
        except EmailNotValidError:
            raise ValueError(f"Invalid email in {ENV_PHOENIX_ADMINS}: '{email_addr}'")
        if username in usernames:
            raise ValueError(f"Duplicate username in {ENV_PHOENIX_ADMINS}: '{username}'")
        if email_addr in emails:
            raise ValueError(f"Duplicate email in {ENV_PHOENIX_ADMINS}: '{email_addr}'")
        usernames.add(username)
        emails.add(email_addr)
        ans[email_addr] = username
    return ans


def get_env_smtp_username() -> str:
    return getenv(ENV_PHOENIX_SMTP_USERNAME, "")


def get_env_smtp_password() -> str:
    return getenv(ENV_PHOENIX_SMTP_PASSWORD, "")


def get_env_smtp_mail_from() -> str:
    return getenv(ENV_PHOENIX_SMTP_MAIL_FROM) or "noreply@arize.com"


def get_env_smtp_hostname() -> str:
    return getenv(ENV_PHOENIX_SMTP_HOSTNAME, "")


def get_env_smtp_port() -> int:
    port = _int_val(ENV_PHOENIX_SMTP_PORT, 587)
    assert 0 < port <= 65_535
    return port


def get_env_smtp_validate_certs() -> bool:
    return _bool_val(ENV_PHOENIX_SMTP_VALIDATE_CERTS, True)


@dataclass(frozen=True)
class OAuth2ClientConfig:
    idp_name: str
    idp_display_name: str
    client_id: str
    client_secret: str
    oidc_config_url: str
    allow_sign_up: bool
    auto_login: bool

    @classmethod
    def from_env(cls, idp_name: str) -> "OAuth2ClientConfig":
        idp_name_upper = idp_name.upper()
        if not (
            client_id := getenv(client_id_env_var := f"PHOENIX_OAUTH2_{idp_name_upper}_CLIENT_ID")
        ):
            raise ValueError(
                f"A client id must be set for the {idp_name} OAuth2 IDP "
                f"via the {client_id_env_var} environment variable"
            )
        if not (
            client_secret := getenv(
                client_secret_env_var := f"PHOENIX_OAUTH2_{idp_name_upper}_CLIENT_SECRET"
            )
        ):
            raise ValueError(
                f"A client secret must be set for the {idp_name} OAuth2 IDP "
                f"via the {client_secret_env_var} environment variable"
            )
        if not (
            oidc_config_url := (
                getenv(
                    oidc_config_url_env_var := f"PHOENIX_OAUTH2_{idp_name_upper}_OIDC_CONFIG_URL",
                )
            )
        ):
            raise ValueError(
                f"An OpenID Connect configuration URL must be set for the {idp_name} OAuth2 IDP "
                f"via the {oidc_config_url_env_var} environment variable"
            )
        allow_sign_up = get_env_oauth2_allow_sign_up(idp_name)
        auto_login = get_env_oauth2_auto_login(idp_name)
        parsed_oidc_config_url = urlparse(oidc_config_url)
        is_local_oidc_config_url = parsed_oidc_config_url.hostname in ("localhost", "127.0.0.1")
        if parsed_oidc_config_url.scheme != "https" and not is_local_oidc_config_url:
            raise ValueError(
                f"Server metadata URL for {idp_name} OAuth2 IDP "
                "must be a valid URL using the https protocol"
            )
        return cls(
            idp_name=idp_name,
            idp_display_name=getenv(
                f"PHOENIX_OAUTH2_{idp_name_upper}_DISPLAY_NAME",
                _get_default_idp_display_name(idp_name),
            ),
            client_id=client_id,
            client_secret=client_secret,
            oidc_config_url=oidc_config_url,
            allow_sign_up=allow_sign_up,
            auto_login=auto_login,
        )


def get_env_oauth2_settings() -> list[OAuth2ClientConfig]:
    """
    Retrieves and validates OAuth2/OpenID Connect (OIDC) identity provider configurations from environment variables.

    This function scans the environment for OAuth2 configuration variables and returns a list of
    configured identity providers. It supports multiple identity providers simultaneously.

    Environment Variable Pattern:
        PHOENIX_OAUTH2_{IDP_NAME}_{CONFIG_TYPE}

    Required Environment Variables for each IDP:
        - PHOENIX_OAUTH2_{IDP_NAME}_CLIENT_ID: The OAuth2 client ID issued by the identity provider
        - PHOENIX_OAUTH2_{IDP_NAME}_CLIENT_SECRET: The OAuth2 client secret issued by the identity provider
        - PHOENIX_OAUTH2_{IDP_NAME}_OIDC_CONFIG_URL: The OpenID Connect configuration URL (must be HTTPS)

    Optional Environment Variables:
        - PHOENIX_OAUTH2_{IDP_NAME}_DISPLAY_NAME: A user-friendly name for the identity provider
        - PHOENIX_OAUTH2_{IDP_NAME}_ALLOW_SIGN_UP: Whether to allow new user registration (defaults to True)
        When set to False, the system will check if the user exists in the database by their email address.
        If the user does not exist or has a password set, they will be redirected to the login page with
        an error message.

    Returns:
        list[OAuth2ClientConfig]: A list of configured OAuth2 identity providers, sorted alphabetically by IDP name.
            Each OAuth2ClientConfig contains the validated configuration for one identity provider.

    Raises:
        ValueError: If required environment variables are missing or invalid.
            Specifically, if the OIDC configuration URL is not HTTPS (except for localhost).

    Example:
        To configure Google as an identity provider, set these environment variables:
        PHOENIX_OAUTH2_GOOGLE_CLIENT_ID=your_client_id
        PHOENIX_OAUTH2_GOOGLE_CLIENT_SECRET=your_client_secret
        PHOENIX_OAUTH2_GOOGLE_OIDC_CONFIG_URL=https://accounts.google.com/.well-known/openid-configuration
        PHOENIX_OAUTH2_GOOGLE_DISPLAY_NAME=Google (optional)
        PHOENIX_OAUTH2_GOOGLE_ALLOW_SIGN_UP=true (optional, defaults to true)
    """  # noqa: E501
    idp_names = set()
    pattern = re.compile(
        r"^PHOENIX_OAUTH2_(\w+)_(DISPLAY_NAME|CLIENT_ID|CLIENT_SECRET|OIDC_CONFIG_URL|ALLOW_SIGN_UP|AUTO_LOGIN)$"  # noqa: E501
    )
    for env_var in os.environ:
        if (match := pattern.match(env_var)) is not None and (idp_name := match.group(1).lower()):
            idp_names.add(idp_name)
    return [OAuth2ClientConfig.from_env(idp_name) for idp_name in sorted(idp_names)]


def get_env_oauth2_allow_sign_up(idp_name: str) -> bool:
    """Retrieves the allow_sign_up setting for a specific OAuth2 identity provider.

    This function determines whether new user registration is allowed for the specified identity provider.
    When set to False, the system will check if the user exists in the database by their email address.
    If the user does not exist or has a password set, they will be redirected to the login page with
    an error message.

    Parameters:
        idp_name (str): The name of the identity provider (e.g., 'google', 'aws_cognito', 'microsoft_entra_id')

    Returns:
        bool: True if new user registration is allowed (default), False otherwise

    Environment Variable:
        PHOENIX_OAUTH2_{IDP_NAME}_ALLOW_SIGN_UP: Controls whether new user registration is allowed (defaults to True if not set)
    """  # noqa: E501
    env_var = f"PHOENIX_OAUTH2_{idp_name}_ALLOW_SIGN_UP".upper()
    return _bool_val(env_var, True)


def get_env_oauth2_auto_login(idp_name: str) -> bool:
    """Retrieves the auto_login setting for a specific OAuth2 identity provider.

    This function determines whether users should be automatically logged in when accessing the OAuth2
    identity provider's login page. When set to True, users will be redirected to the identity provider's
    login page without first seeing the application's login page.

    Parameters:
        idp_name (str): The name of the identity provider (e.g., 'google', 'aws_cognito', 'microsoft_entra_id')

    Returns:
        bool: True if auto-login is enabled, False otherwise (defaults to False if not set)

    Environment Variable:
        PHOENIX_OAUTH2_{IDP_NAME}_AUTO_LOGIN: Controls whether auto-login is enabled (defaults to False if not set)
    """  # noqa: E501
    env_var = f"PHOENIX_OAUTH2_{idp_name}_AUTO_LOGIN".upper()
    return _bool_val(env_var, False)


PHOENIX_DIR = Path(__file__).resolve().parent
# Server config
SERVER_DIR = PHOENIX_DIR / "server"
HOST = "0.0.0.0"
"""The host the server will run on after launch_app is called."""
PORT = 6006
"""The port the server will run on after launch_app is called."""
HOST_ROOT_PATH = ""
"""The ASGI root path of the server, i.e. the root path where the web application is mounted"""
GRPC_PORT = 4317
"""The port the gRPC server will run on after launch_app is called.
The default network port for OTLP/gRPC is 4317.
See https://opentelemetry.io/docs/specs/otlp/#otlpgrpc-default-port"""
GENERATED_INFERENCES_NAME_PREFIX = "phoenix_inferences_"
"""The prefix of datasets that are auto-assigned a name."""
WORKING_DIR = get_working_dir()
"""The work directory for saving, loading, and exporting data."""


class DirectoryError(Exception):
    def __init__(self, message: Optional[str] = None) -> None:
        if message is None:
            message = (
                "Local storage is not configured. Please set the "
                "PHOENIX_WORKING_DIR environment variable to fix this."
            )
        super().__init__(message)


def get_env_postgres_connection_str() -> Optional[str]:
    pg_user = os.getenv(ENV_PHOENIX_POSTGRES_USER)
    pg_password = os.getenv(ENV_PHOENIX_POSTGRES_PASSWORD)
    pg_host = os.getenv(ENV_PHOENIX_POSTGRES_HOST)
    pg_port = os.getenv(ENV_PHOENIX_POSTGRES_PORT)
    pg_db = os.getenv(ENV_PHOENIX_POSTGRES_DB)

    if pg_host and ":" in pg_host:
        pg_host, parsed_port = pg_host.split(":")
        pg_port = pg_port or parsed_port  # use the explicitly set port if provided

    if pg_host and pg_user and pg_password:
        encoded_password = quote_plus(pg_password)
        connection_str = f"postgresql://{pg_user}:{encoded_password}@{pg_host}"
        if pg_port:
            connection_str = f"{connection_str}:{pg_port}"
        if pg_db:
            connection_str = f"{connection_str}/{pg_db}"

        return connection_str
    return None


def _no_local_storage() -> bool:
    """
    Check if we're using a postgres database by checking if postgres connection string is set
    and a working directory was not explicitly set.
    """
    return get_env_postgres_connection_str() is not None and getenv(ENV_PHOENIX_WORKING_DIR) is None


class RestrictedPath(wrapt.ObjectProxy):  # type: ignore[misc]
    """
    This wraps pathlib.Path and will raise a DirectoryError if no local storage is configured.

    Users can forego configuring a working directory if they are using a postgres database. If this
    condition is met, the working directory path wrapped by this object will raise an error when
    accessed in any way.
    """

    def __init__(self, wrapped: Union[str, Path]) -> None:
        super().__init__(Path(wrapped))
        self.__wrapped__: Path

    def _check_forbidden(self) -> None:
        if _no_local_storage():
            raise DirectoryError()
        return

    def __getattr__(self, name: str) -> Any:
        attr = getattr(self.__wrapped__, name)

        if callable(attr):

            def wrapped_attr(*args: Any, **kwargs: Any) -> Any:
                result = attr(*args, **kwargs)
                if isinstance(result, Path):
                    self._check_forbidden()
                    return RestrictedPath(result)
                elif hasattr(result, "__iter__") and not isinstance(result, (str, bytes)):
                    return (RestrictedPath(p) if isinstance(p, Path) else p for p in result)
                return result

            return wrapped_attr
        else:
            if isinstance(attr, Path):
                self._check_forbidden()
                return RestrictedPath(attr)
            return attr

    def __str__(self) -> str:
        self._check_forbidden()
        return str(self.__wrapped__)

    def __repr__(self) -> str:
        return f"<RestrictedPath({repr(self.__wrapped__)})>"

    def __fspath__(self) -> str:
        self._check_forbidden()
        return str(self.__wrapped__)

    def __truediv__(self, other: Union[str, Path]) -> Path:
        self._check_forbidden()
        return self.__wrapped__ / other

    def __itruediv__(self, other: Union[str, Path]) -> Path:
        self.__wrapped__ /= other
        self._check_forbidden()
        return self.__wrapped__

    def __eq__(self, other: object) -> bool:
        if isinstance(other, RestrictedPath):
            return bool(self.__wrapped__ == other.__wrapped__)
        return bool(self.__wrapped__ == other)

    def __hash__(self) -> int:
        return hash(self.__wrapped__)

    def __len__(self) -> int:
        return len(self.__wrapped__.parts)

    def __contains__(self, item: str) -> bool:
        return item in self.__wrapped__.parts


ROOT_DIR = RestrictedPath(WORKING_DIR)
EXPORT_DIR = RestrictedPath(WORKING_DIR / "exports")
INFERENCES_DIR = RestrictedPath(WORKING_DIR / "inferences")
TRACE_DATASETS_DIR = RestrictedPath(WORKING_DIR / "trace_datasets")


def ensure_working_dir_if_needed() -> None:
    """
    Ensure the working directory exists. This is needed because the working directory
    must exist before certain operations can be performed.

    This is bypassed if a postgres database is configured and a working directory is not set.
    """
    if _no_local_storage():
        return

    logger.info(f"📋 Ensuring phoenix working directory: {WORKING_DIR}")
    try:
        for path in (
            ROOT_DIR,
            EXPORT_DIR,
            INFERENCES_DIR,
            TRACE_DATASETS_DIR,
        ):
            path.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        print(
            "💥 Failed to initialize the working directory at "
            + f"{WORKING_DIR} due to an error: {str(e)}."
            + "Phoenix requires a working directory to persist data"
        )
        raise


# Invoke ensure_working_dir_if_needed() to ensure the working directory exists
ensure_working_dir_if_needed()


def get_exported_files(directory: Path) -> list[Path]:
    """
    Yields the list of paths of exported files.

    Parameters
    ----------
    directory: Path
        Disk location to search exported files.

    Returns
    -------
    list: list[Path]
        List of paths of the exported files.
    """
    if _no_local_storage():
        return []  # Do not attempt to access local storage
    return list(directory.glob("*.parquet"))


def get_env_port() -> int:
    if not (port := getenv(ENV_PHOENIX_PORT)):
        return PORT
    if port.isnumeric():
        return int(port)
    if _KUBERNETES_PHOENIX_PORT_PATTERN.match(port) is not None:
        raise ValueError(
            'If you are deploying Phoenix with Kubernetes using a service named "phoenix", '
            "Kubernetes will automatically generate an environment variable `PHOENIX_PORT` "
            'of the form "tcp://<IP>:<PORT>" that is not the integer format Phoenix expects. '
            "To resolve this issue, explicitly set the `PHOENIX_PORT` environment variable to "
            "an integer value in your Kubernetes deployment configuration."
        )
    raise ValueError(
        f"Invalid value for environment variable {ENV_PHOENIX_PORT}: "
        f"{port}. Value must be an integer."
    )


def get_env_grpc_port() -> int:
    if not (port := getenv(ENV_PHOENIX_GRPC_PORT)):
        return GRPC_PORT
    if port.isnumeric():
        return int(port)
    raise ValueError(
        f"Invalid value for environment variable {ENV_PHOENIX_GRPC_PORT}: "
        f"{port}. Value must be an integer."
    )


def get_env_host() -> str:
    return getenv(ENV_PHOENIX_HOST) or HOST


def get_env_host_root_path() -> str:
    if not (host_root_path := getenv(ENV_PHOENIX_HOST_ROOT_PATH)):
        return HOST_ROOT_PATH
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


def get_env_collector_endpoint() -> Optional[str]:
    return getenv(ENV_PHOENIX_COLLECTOR_ENDPOINT)


def get_env_project_name() -> str:
    return getenv(ENV_PHOENIX_PROJECT_NAME, DEFAULT_PROJECT_NAME)


def get_env_database_connection_str() -> str:
    if phoenix_url := os.getenv(ENV_PHOENIX_SQL_DATABASE_URL):
        return phoenix_url

    if postgres_url := get_env_postgres_connection_str():
        return postgres_url

    working_dir = get_working_dir()
    return f"sqlite:///{working_dir}/phoenix.db"


def get_env_database_schema() -> Optional[str]:
    if get_env_database_connection_str().startswith("sqlite"):
        return None
    return getenv(ENV_PHOENIX_SQL_DATABASE_SCHEMA)


def get_env_database_allocated_storage_capacity_gibibytes() -> Optional[float]:
    return _float_val(ENV_PHOENIX_DATABASE_ALLOCATED_STORAGE_CAPACITY_GIBIBYTES)


def get_env_enable_prometheus() -> bool:
    if (enable_promotheus := getenv(ENV_PHOENIX_ENABLE_PROMETHEUS)) is None or (
        enable_promotheus_lower := enable_promotheus.lower()
    ) == "false":
        return False
    if enable_promotheus_lower == "true":
        return True
    raise ValueError(
        f"Invalid value for environment variable {ENV_PHOENIX_ENABLE_PROMETHEUS}: "
        f"{enable_promotheus}. Value values are 'TRUE' and 'FALSE' (case-insensitive)."
    )


def get_env_client_headers() -> dict[str, str]:
    headers = parse_env_headers(getenv(ENV_PHOENIX_CLIENT_HEADERS))
    if (api_key := get_env_phoenix_api_key()) and "authorization" not in [
        k.lower() for k in headers
    ]:
        headers["Authorization"] = f"Bearer {api_key}"
    return headers


def get_env_root_url() -> URL:
    """
    Get the URL used to access Phoenix from a web browser

    Returns:
        URL: The root URL of the Phoenix server

    Note:
        This is intended to replace the legacy `get_base_url()` helper function. In
        particular, `get_env_collector_endpoint()` is really for the client and should be
        deprecated on the server side.
    """
    if root_url := getenv(ENV_PHOENIX_ROOT_URL):
        result = urlparse(root_url)
        if not result.scheme or not result.netloc:
            raise ValueError(
                f"The environment variable `{ENV_PHOENIX_ROOT_URL}` must be a valid URL."
            )
        return URL(root_url)
    host = get_env_host()
    if host == "0.0.0.0":
        host = "127.0.0.1"
    scheme = "https" if get_env_tls_enabled_for_http() else "http"
    return URL(urljoin(f"{scheme}://{host}:{get_env_port()}", get_env_host_root_path()))


def get_base_url() -> str:
    """Deprecated: Use get_env_root_url() instead, but note the difference in behavior."""
    host = get_env_host()
    if host == "0.0.0.0":
        host = "127.0.0.1"
    scheme = "https" if get_env_tls_enabled_for_http() else "http"
    base_url = get_env_collector_endpoint() or f"{scheme}://{host}:{get_env_port()}"
    return base_url if base_url.endswith("/") else base_url + "/"


def get_web_base_url() -> str:
    """Return the web UI base URL.

    Returns:
        str: the web UI base URL
    """
    from phoenix.session.session import active_session

    if session := active_session():
        return session.url
    return get_base_url()


class LoggingMode(Enum):
    DEFAULT = "default"
    STRUCTURED = "structured"


def get_env_logging_mode() -> LoggingMode:
    if (logging_mode := getenv(ENV_LOGGING_MODE)) is None:
        return LoggingMode.DEFAULT
    try:
        return LoggingMode(logging_mode.lower().strip())
    except ValueError:
        raise ValueError(
            f"Invalid value `{logging_mode}` for env var `{ENV_LOGGING_MODE}`. "
            f"Valid values are: {log_a_list([mode.value for mode in LoggingMode], 'and')} "
            "(case-insensitive)."
        )


def get_env_logging_level() -> int:
    return _get_logging_level(
        env_var=ENV_LOGGING_LEVEL,
        default_level=logging.INFO,
    )


def get_env_db_logging_level() -> int:
    return _get_logging_level(
        env_var=ENV_DB_LOGGING_LEVEL,
        default_level=logging.WARNING,
    )


def get_env_fastapi_middleware_paths() -> list[tuple[str, str]]:
    env_value = getenv(ENV_PHOENIX_FASTAPI_MIDDLEWARE_PATHS, "")
    paths = []
    for entry in env_value.split(","):
        entry = entry.strip()
        if entry:
            if ":" not in entry:
                raise ValueError(
                    f"Invalid middleware entry '{entry}'. Expected format 'file_path:ClassName'."
                )
            file_path, object_name = entry.split(":", 1)
            paths.append((file_path.strip(), object_name.strip()))
    return paths


def get_env_gql_extension_paths() -> list[tuple[str, str]]:
    env_value = getenv(ENV_PHOENIX_GQL_EXTENSION_PATHS, "")
    paths = []
    for entry in env_value.split(","):
        entry = entry.strip()
        if entry:
            if ":" not in entry:
                raise ValueError(
                    f"Invalid extension entry '{entry}'. Expected format 'file_path:ClassName'."
                )
            file_path, object_name = entry.split(":", 1)
            paths.append((file_path.strip(), object_name.strip()))
    return paths


def get_env_grpc_interceptor_paths() -> list[tuple[str, str]]:
    env_value = getenv(ENV_PHOENIX_GRPC_INTERCEPTOR_PATHS, "")
    paths = []
    for entry in env_value.split(","):
        entry = entry.strip()
        if entry:
            if ":" not in entry:
                raise ValueError(
                    f"Invalid interceptor entry '{entry}'. Expected format 'file_path:ClassName'."
                )
            file_path, object_name = entry.split(":", 1)
            paths.append((file_path.strip(), object_name.strip()))
    return paths


def _get_logging_level(env_var: str, default_level: int) -> int:
    logging_level = getenv(env_var)
    if not logging_level:
        return default_level

    # levelNamesMapping = logging.getLevelNamesMapping() is not supported in python 3.8
    # but is supported in 3.12. Hence, we define the mapping ourselves and will remove
    # this once we drop support for older python versions
    levelNamesMapping = logging._nameToLevel.copy()

    valid_values = [level for level in levelNamesMapping if level != "NOTSET"]

    if logging_level.upper() not in valid_values:
        raise ValueError(
            f"Invalid value `{logging_level}` for env var `{env_var}`. "
            f"Valid values are: {log_a_list(valid_values, 'and')} (case-insensitive)."
        )
    return levelNamesMapping[logging_level.upper()]


def get_env_log_migrations() -> bool:
    log_migrations = getenv(ENV_LOG_MIGRATIONS)
    # Default to True
    if log_migrations is None:
        return True

    if log_migrations.lower() == "true":
        return True
    elif log_migrations.lower() == "false":
        return False
    else:
        raise ValueError(
            f"Invalid value for environment variable {ENV_LOG_MIGRATIONS}: "
            f"{log_migrations}. Value values are 'TRUE' and 'FALSE' (case-insensitive)."
        )


class OAuth2Idp(Enum):
    AWS_COGNITO = "aws_cognito"
    GOOGLE = "google"
    MICROSOFT_ENTRA_ID = "microsoft_entra_id"


def _get_default_idp_display_name(idp_name: str) -> str:
    """
    Get the default display name for an OAuth2 IDP.
    """
    if idp_name == OAuth2Idp.AWS_COGNITO.value:
        return "AWS Cognito"
    if idp_name == OAuth2Idp.MICROSOFT_ENTRA_ID.value:
        return "Microsoft Entra ID"
    return idp_name.replace("_", " ").title()


def get_env_disable_migrations() -> bool:
    return _bool_val(ENV_PHOENIX_DANGEROUSLY_DISABLE_MIGRATIONS, False)


DEFAULT_PROJECT_NAME = "default"
_KUBERNETES_PHOENIX_PORT_PATTERN = re.compile(r"^tcp://\d{1,3}[.]\d{1,3}[.]\d{1,3}[.]\d{1,3}:\d+$")


def get_env_allowed_origins() -> Optional[list[str]]:
    """
    Gets the value of the PHOENIX_ALLOWED_ORIGINS environment variable.
    """
    allowed_origins = getenv(ENV_PHOENIX_ALLOWED_ORIGINS)
    if allowed_origins is None:
        return None

    return allowed_origins.split(",")


def verify_server_environment_variables() -> None:
    """Verify that the environment variables are set correctly. Raises an error otherwise."""
    get_env_root_url()
    get_env_phoenix_secret()
    get_env_phoenix_admin_secret()

    # Notify users about deprecated environment variables if they are being used.
    if os.getenv("PHOENIX_ENABLE_WEBSOCKETS") is not None:
        logger.warning(
            "The environment variable PHOENIX_ENABLE_WEBSOCKETS is deprecated "
            "because WebSocket is no longer necessary."
        )


SKLEARN_VERSION = cast(tuple[int, int], tuple(map(int, version("scikit-learn").split(".", 2)[:2])))
PLAYGROUND_PROJECT_NAME = "playground"

SYSTEM_USER_ID: Optional[int] = None
"""
The ID of the system user in the database.

This value is set during application startup by the facilitator and is used to
identify the system user for authentication purposes.

When the PHOENIX_ADMIN_SECRET is used as a bearer token in API requests, the
request is authenticated as the system user with the user_id set to this
SYSTEM_USER_ID value (only if this variable is not None).
"""


def _validate_file_exists_and_is_readable(
    file_path: Path,
    description: str,
    check_non_empty: bool = True,
) -> None:
    """
    Validate that a file exists, is readable, and optionally has non-zero size.

    Args:
        file_path: Path to the file to validate
        description: Description of the file for error messages (e.g., "certificate", "key", "CA")
        check_non_empty: Whether to check if the file has non-zero size. Defaults to True.

    Raises:
        ValueError: If the path is not a file, isn't readable, or has zero size (if check_non_empty is True)
    """  # noqa: E501
    if not file_path.is_file():
        raise ValueError(f"{description} path is not a file: {file_path}")
    if check_non_empty and file_path.stat().st_size == 0:
        raise ValueError(f"{description} file is empty: {file_path}")
    try:
        with open(file_path, "rb") as f:
            f.read(1)  # Read just one byte to verify readability
    except Exception as e:
        raise ValueError(f"{description} file is not readable: {e}")
