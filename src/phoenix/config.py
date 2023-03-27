import errno
import tempfile
from pathlib import Path


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


PHOENIX_DIR = Path(__file__).resolve().parent
for dir in (
    ROOT_DIR := Path.home().resolve() / ".phoenix",
    EXPORT_DIR := ROOT_DIR / "exports",
    DATASET_DIR := ROOT_DIR / "datasets",
):
    dir.mkdir(parents=True, exist_ok=True)

# Server config
SERVER_DIR = PHOENIX_DIR / "server"
# The port the server will run on after launch_app is called
PORT = 6060
