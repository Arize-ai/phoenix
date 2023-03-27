import errno
import os
import tempfile
from pathlib import Path


def normalize_path(path: str) -> str:
    """Normalizes the given path by converting it to an absolute path and
    expanding the user directory, if necessary.
    Args:
        path: a path
    Returns:
        the normalized path
    """
    return os.path.expanduser(path)


def _get_temp_path() -> Path:
    """Get path to  directory in which to store temp phoenix server files."""
    return Path(tempfile.gettempdir()) / ".arize-phoenix"


def get_pids_path() -> Path:
    """Get path to directory in which to store temp phoenix instance pid files.
    This directory is used to track any currently running instances of Arize Phoenix
    on the host machine. The directory will be created if it does not exist.
    """
    path = _get_temp_path() / "pids"
    try:
        path.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        if e.errno == errno.EEXIST:
            pass
        else:
            raise
    else:
        path.chmod(0o777)
    return path


PHOENIX_DIR = Path.cwd()
ROOT_DIR = Path.home() / ".phoenix"
dataset_dir = ROOT_DIR / "datasets"

# Server config
server_dir = PHOENIX_DIR / "server"
# The port the server will run on after launch_app is called
port = 6060
