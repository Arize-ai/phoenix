import os


def normalize_path(path: str) -> str:
    """Normalizes the given path by converting it to an absolute path and
    expanding the user directory, if necessary.
    Args:
        path: a path
    Returns:
        the normalized path
    """
    return os.path.expanduser(path)


PHOENIX_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.join("~", "phoenix")
dataset_dir = normalize_path(os.path.join(ROOT_DIR, "datasets"))

# Server config
server_dir = os.path.join(PHOENIX_DIR, "server")
# The port the server will run on after launch_app is called
port = 6060
server_reload = True
graphiql = True
