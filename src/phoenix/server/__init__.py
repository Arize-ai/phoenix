import errno
import os
import tempfile

from .app import create_app


def _get_temp_path() -> str:
    """Get path to  directory in which to store temp phoenix server files.
    """
    return os.path.join(tempfile.gettempdir(), ".arize-phoenix")


def get_pids_path() -> str:
    """Get path to directory in which to store temp phoenix instance pid files.
    This directory is used to track any currently running instances of Arize Phoenix
    on the host machine. The directory will be created if it does not exist.
    """
    path = os.path.join(_get_temp_path(), "pids")
    try:
        os.makedirs(path)
    except OSError as e:
        if e.errno == errno.EEXIST:
            pass
        else:
            raise
    else:
        os.chmod(path, 0o777)
    return path
