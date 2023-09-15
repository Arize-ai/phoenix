import os
import tempfile
from pathlib import Path
from typing import List, Optional


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


for path in (
    ROOT_DIR := Path.home().resolve() / ".phoenix",
    EXPORT_DIR := ROOT_DIR / "exports",
    DATASET_DIR := ROOT_DIR / "datasets",
):
    path.mkdir(parents=True, exist_ok=True)

PHOENIX_DIR = Path(__file__).resolve().parent
# Server config
SERVER_DIR = PHOENIX_DIR / "server"
# The host the server will run on after launch_app is called
HOST = "127.0.0.1"
# The port the server will run on after launch_app is called
PORT = 6060
# The prefix of datasets that are auto-assigned a name
GENERATED_DATASET_NAME_PREFIX = "phoenix_dataset_"


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
        if isinstance(port := os.getenv("PHOENIX_PORT"), str) and port.isnumeric()
        else PORT
    )


def get_env_host() -> str:
    return os.getenv("PHOENIX_HOST") or HOST
