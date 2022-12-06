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


ROOT_DIR = os.path.join("~", "phoenix")
dataset_dir = normalize_path(os.path.join(ROOT_DIR, "datasets"))
