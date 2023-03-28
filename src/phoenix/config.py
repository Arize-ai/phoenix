import tempfile
from heapq import nlargest
from pathlib import Path
from typing import Iterator


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


for dir in (
    ROOT_DIR := Path.home().resolve() / ".phoenix",
    EXPORT_DIR := ROOT_DIR / "exports",
    DATASET_DIR := ROOT_DIR / "datasets",
):
    dir.mkdir(parents=True, exist_ok=True)

PHOENIX_DIR = Path(__file__).resolve().parent
# Server config
SERVER_DIR = PHOENIX_DIR / "server"
# The port the server will run on after launch_app is called
PORT = 6060


def get_exported_files(
    n_latest: int = 5,
    directory: Path = EXPORT_DIR,
    extension: str = "parquet",
) -> Iterator[Path]:
    """
    Yields n most recently exported files by descending modification time.

    Parameters
    ----------
    n_latest: int, optional, default=5
        Specifies the number of the most recent exported files to return. If
        there are fewer than n exported files then fewer than n files will
        be returned.

    Returns
    -------
    iterator: Iterator[Path]
        An iterable of file path for the n most recent exported files.
    """
    yield from nlargest(
        n_latest,
        directory.glob("*." + extension),
        lambda p: p.stat().st_mtime,
    )
