from os import path


def is_url(filepath: str) -> bool:
    url_prefixes = ["http://", "https://"]
    return any([filepath.startswith(prefix) for prefix in url_prefixes])


def parse_file_format(filepath: str) -> str:
    return path.splitext(filepath)[-1]


def parse_filename(filepath: str) -> str:
    return path.basename(filepath)
