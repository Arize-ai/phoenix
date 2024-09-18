import logging
import os
import re
import tempfile
from datetime import timedelta
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Tuple, overload

from phoenix.utilities.logging import log_a_list

from .utilities.re import parse_env_headers

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
ENV_PHOENIX_SQL_DATABASE_SCHEMA = "PHOENIX_SQL_DATABASE_SCHEMA"
"""
The schema to use for the PostgresSQL database. (This is ignored for SQLite.)
See e.g. https://www.postgresql.org/docs/current/ddl-schemas.html
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

# Phoenix server OpenTelemetry instrumentation environment variables
ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT = (
    "PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT"
)
ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_GRPC_ENDPOINT = (
    "PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_GRPC_ENDPOINT"
)

# Auth is under active development. Phoenix users are strongly advised not to
# set these environment variables until the feature is officially released.
ENV_PHOENIX_ENABLE_AUTH = "PHOENIX_ENABLE_AUTH"
ENV_PHOENIX_SECRET = "PHOENIX_SECRET"
ENV_PHOENIX_API_KEY = "PHOENIX_API_KEY"
ENV_PHOENIX_USE_SECURE_COOKIES = "PHOENIX_USE_SECURE_COOKIES"
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


def server_instrumentation_is_enabled() -> bool:
    return bool(
        os.getenv(ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT)
    ) or bool(os.getenv(ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_GRPC_ENDPOINT))


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
    working_dir_str = os.getenv(ENV_PHOENIX_WORKING_DIR)
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
    if (value := os.environ.get(env_var)) is None:
        return default
    assert (lower := value.lower()) in (
        "true",
        "false",
    ), f"{env_var} must be set to TRUE or FALSE (case-insensitive)"
    return lower == "true"


@overload
def _float_val(env_var: str) -> Optional[float]: ...
@overload
def _float_val(env_var: str, default: float) -> float: ...
def _float_val(env_var: str, default: Optional[float] = None) -> Optional[float]:
    """
    Parses a numeric environment variable, returning `default` if the variable is not set.
    """
    if (value := os.environ.get(env_var)) is None:
        return default
    try:
        return float(value)
    except ValueError:
        raise ValueError(
            f"Invalid value for environment variable {env_var}: {value}. "
            f"Value must be a number."
        )


@overload
def _int_val(env_var: str) -> Optional[int]: ...
@overload
def _int_val(env_var: str, default: int) -> int: ...
def _int_val(env_var: str, default: Optional[int] = None) -> Optional[int]:
    """
    Parses a numeric environment variable, returning `default` if the variable is not set.
    """
    if (value := os.environ.get(env_var)) is None:
        return default
    try:
        return int(value)
    except ValueError:
        raise ValueError(
            f"Invalid value for environment variable {env_var}: {value}. "
            f"Value must be an integer."
        )


def get_env_enable_auth() -> bool:
    """
    Gets the value of the PHOENIX_ENABLE_AUTH environment variable.
    """
    return _bool_val(ENV_PHOENIX_ENABLE_AUTH, False)


def get_env_phoenix_secret() -> Optional[str]:
    """
    Gets the value of the PHOENIX_SECRET environment variable
    and performs validation.
    """
    phoenix_secret = os.environ.get(ENV_PHOENIX_SECRET)
    if phoenix_secret is None:
        return None
    from phoenix.auth import REQUIREMENTS_FOR_PHOENIX_SECRET

    REQUIREMENTS_FOR_PHOENIX_SECRET.validate(phoenix_secret, "Phoenix secret")
    return phoenix_secret


def get_env_phoenix_use_secure_cookies() -> bool:
    return _bool_val(ENV_PHOENIX_USE_SECURE_COOKIES, False)


def get_env_phoenix_api_key() -> Optional[str]:
    return os.environ.get(ENV_PHOENIX_API_KEY)


def get_env_auth_settings() -> Tuple[bool, Optional[str]]:
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
    return enable_auth, phoenix_secret


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


def get_env_smtp_username() -> str:
    return os.getenv(ENV_PHOENIX_SMTP_USERNAME) or ""


def get_env_smtp_password() -> str:
    return os.getenv(ENV_PHOENIX_SMTP_PASSWORD) or ""


def get_env_smtp_mail_from() -> str:
    return os.getenv(ENV_PHOENIX_SMTP_MAIL_FROM) or ""


def get_env_smtp_hostname() -> str:
    return os.getenv(ENV_PHOENIX_SMTP_HOSTNAME) or ""


def get_env_smtp_port() -> int:
    port = _int_val(ENV_PHOENIX_SMTP_PORT, 587)
    assert 0 < port <= 65_535
    return port


def get_env_smtp_validate_certs() -> bool:
    return _bool_val(ENV_PHOENIX_SMTP_VALIDATE_CERTS, True)


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

ROOT_DIR = WORKING_DIR
EXPORT_DIR = ROOT_DIR / "exports"
INFERENCES_DIR = ROOT_DIR / "inferences"
TRACE_DATASETS_DIR = ROOT_DIR / "trace_datasets"


def ensure_working_dir() -> None:
    """
    Ensure the working directory exists. This is needed because the working directory
    must exist before certain operations can be performed.
    """
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


# Invoke ensure_working_dir() to ensure the working directory exists
ensure_working_dir()


def get_exported_files(directory: Path) -> List[Path]:
    """
    Yields the list of paths of exported files.

    Parameters
    ----------
    directory: Path
        Disk location to search exported files.

    Returns
    -------
    list: List[Path]
        List of paths of the exported files.
    """
    return list(directory.glob("*.parquet"))


def get_env_port() -> int:
    if not (port := os.getenv(ENV_PHOENIX_PORT)):
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
    if not (port := os.getenv(ENV_PHOENIX_GRPC_PORT)):
        return GRPC_PORT
    if port.isnumeric():
        return int(port)
    raise ValueError(
        f"Invalid value for environment variable {ENV_PHOENIX_GRPC_PORT}: "
        f"{port}. Value must be an integer."
    )


def get_env_host() -> str:
    return os.getenv(ENV_PHOENIX_HOST) or HOST


def get_env_host_root_path() -> str:
    return os.getenv(ENV_PHOENIX_HOST_ROOT_PATH) or HOST_ROOT_PATH


def get_env_collector_endpoint() -> Optional[str]:
    return os.getenv(ENV_PHOENIX_COLLECTOR_ENDPOINT)


def get_env_project_name() -> str:
    return os.getenv(ENV_PHOENIX_PROJECT_NAME) or DEFAULT_PROJECT_NAME


def get_env_database_connection_str() -> str:
    env_url = os.getenv(ENV_PHOENIX_SQL_DATABASE_URL)
    if env_url is None:
        working_dir = get_working_dir()
        return f"sqlite:///{working_dir}/phoenix.db"
    return env_url


def get_env_database_schema() -> Optional[str]:
    if get_env_database_connection_str().startswith("sqlite"):
        return None
    return os.getenv(ENV_PHOENIX_SQL_DATABASE_SCHEMA)


def get_env_enable_prometheus() -> bool:
    if (enable_promotheus := os.getenv(ENV_PHOENIX_ENABLE_PROMETHEUS)) is None or (
        enable_promotheus_lower := enable_promotheus.lower()
    ) == "false":
        return False
    if enable_promotheus_lower == "true":
        return True
    raise ValueError(
        f"Invalid value for environment variable {ENV_PHOENIX_ENABLE_PROMETHEUS}: "
        f"{enable_promotheus}. Value values are 'TRUE' and 'FALSE' (case-insensitive)."
    )


def get_env_client_headers() -> Optional[Dict[str, str]]:
    if headers_str := os.getenv(ENV_PHOENIX_CLIENT_HEADERS):
        return parse_env_headers(headers_str)
    return None


def get_base_url() -> str:
    host = get_env_host()
    if host == "0.0.0.0":
        host = "127.0.0.1"
    base_url = get_env_collector_endpoint() or f"http://{host}:{get_env_port()}"
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
    if (logging_mode := os.getenv(ENV_LOGGING_MODE)) is None:
        return LoggingMode.DEFAULT
    try:
        return LoggingMode(logging_mode.lower().strip())
    except ValueError:
        raise ValueError(
            f"Invalid value `{logging_mode}` for env var `{ENV_LOGGING_MODE}`. "
            f"Valid values are: {log_a_list([mode.value for mode in LoggingMode],'and')} "
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


def _get_logging_level(env_var: str, default_level: int) -> int:
    logging_level = os.getenv(env_var)
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
            f"Valid values are: {log_a_list(valid_values,'and')} (case-insensitive)."
        )
    return levelNamesMapping[logging_level.upper()]


def get_env_log_migrations() -> bool:
    log_migrations = os.getenv(ENV_LOG_MIGRATIONS)
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


DEFAULT_PROJECT_NAME = "default"
_KUBERNETES_PHOENIX_PORT_PATTERN = re.compile(r"^tcp://\d{1,3}[.]\d{1,3}[.]\d{1,3}[.]\d{1,3}:\d+$")
