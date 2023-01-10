#                  Copyright 2023 Arize AI and contributors.
#                   Licensed under the Elastic License 2.0;
# you may not use this file except in compliance with the Elastic License 2.0.

import errno
import os
import tempfile


def normalize_path(path: str) -> str:
    """Normalizes the given path by converting it to an absolute path and
    expanding the user directory, if necessary.
    Args:
        path: a path
    Returns:
        the normalized path
    """
    return os.path.expanduser(path)


def _get_temp_path() -> str:
    """Get path to  directory in which to store temp phoenix server files."""
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


PHOENIX_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.join("~", "phoenix")
dataset_dir = normalize_path(os.path.join(ROOT_DIR, "datasets"))

# Server config
server_dir = os.path.join(PHOENIX_DIR, "server")
# The port the server will run on after launch_app is called
port = 6060
# TODO(#154) inject environment variables into runtime
graphiql = True
debug = True
