import tempfile
from pathlib import Path
from typing import List


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


for path in (
    ROOT_DIR := Path.home().resolve() / ".phoenix",
    EXPORT_DIR := ROOT_DIR / "exports",
    DATASET_DIR := ROOT_DIR / "datasets",
):
    path.mkdir(parents=True, exist_ok=True)

PHOENIX_DIR = Path(__file__).resolve().parent
# Server config
SERVER_DIR = PHOENIX_DIR / "server"
# The port the server will run on after launch_app is called
PORT = 6060


def get_exported_files(directory: Path) -> List[Path]:
    """
    Yields n most recently exported files by descending modification time.

    Parameters
    ----------
    directory: Path
        Disk location to search exported files.

    Returns
    -------
    list: List[Path]
        List of paths of the n most recent exported files.
    """
    return list(directory.glob("*.parquet"))
