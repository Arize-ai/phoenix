import os
import tempfile
from enum import Enum
from pathlib import Path
from typing import List, Optional

# Phoenix environment variables
ENV_PHOENIX_PORT = "PHOENIX_PORT"
ENV_PHOENIX_HOST = "PHOENIX_HOST"
ENV_NOTEBOOK_ENV = "PHOENIX_NOTEBOOK_ENV"
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
ENV_PHOENIX_SQL_DATABASE = "PHOENIX_SQL_DATABASE"
"""
The database URL to use when logging traces and evals.
"""
ENV_SPAN_STORAGE_TYPE = "__DANGEROUS__PHOENIX_SPAN_STORAGE_TYPE"
"""
**EXPERIMENTAL**
The type of span storage to use.
"""


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


def get_storage_dir() -> Path:
    """
    Get the directory for storing traces.
    """
    return get_working_dir() / "storage"


PHOENIX_DIR = Path(__file__).resolve().parent
# Server config
SERVER_DIR = PHOENIX_DIR / "server"
# The host the server will run on after launch_app is called
HOST = "0.0.0.0"
# The port the server will run on after launch_app is called
PORT = 6006
# The prefix of datasets that are auto-assigned a name
GENERATED_DATASET_NAME_PREFIX = "phoenix_dataset_"
# The work directory for saving, loading, and exporting datasets
WORKING_DIR = get_working_dir()

try:
    for path in (
        ROOT_DIR := WORKING_DIR,
        EXPORT_DIR := ROOT_DIR / "exports",
        DATASET_DIR := ROOT_DIR / "datasets",
        TRACE_DATASET_DIR := ROOT_DIR / "trace_datasets",
    ):
        path.mkdir(parents=True, exist_ok=True)
except Exception as e:
    print(
        f"⚠️ Failed to initialize the working directory at {WORKING_DIR} due to an error: {str(e)}"
    )
    print("⚠️ While phoenix will still run, you will not be able to save, load, or export data")
    print(
        f"ℹ️ To change, set the `{ENV_PHOENIX_WORKING_DIR}` environment variable before importing phoenix."  # noqa: E501
    )


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
    return (
        int(port)
        if isinstance(port := os.getenv(ENV_PHOENIX_PORT), str) and port.isnumeric()
        else PORT
    )


def get_env_host() -> str:
    return os.getenv(ENV_PHOENIX_HOST) or HOST


def get_env_collector_endpoint() -> Optional[str]:
    return os.getenv(ENV_PHOENIX_COLLECTOR_ENDPOINT)


def get_env_project_name() -> str:
    return os.getenv(ENV_PHOENIX_PROJECT_NAME) or DEFAULT_PROJECT_NAME


def get_env_span_storage_type() -> Optional["SpanStorageType"]:
    """
    Get the type of span storage to use.
    """
    if not (env_type_str := os.getenv(ENV_SPAN_STORAGE_TYPE)):
        return None
    try:
        return SpanStorageType(env_type_str.lower())
    except ValueError:
        raise ValueError(
            f"⚠️ Invalid span storage type value `{env_type_str}` defined by the "
            f"environment variable `{ENV_SPAN_STORAGE_TYPE}`. Valid values are: "
            f"{', '.join(t.value for t in SpanStorageType)}."
        )


def get_env_database_connection_str() -> str:
    env_url = os.getenv(ENV_PHOENIX_SQL_DATABASE)
    if env_url is None:
        working_dir = get_working_dir()
        return f"sqlite:///{working_dir}/phoenix.db"
    return env_url


class SpanStorageType(Enum):
    TEXT_FILES = "text-files"


DEFAULT_PROJECT_NAME = "default"
