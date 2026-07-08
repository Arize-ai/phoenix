import re

SECRET_KEY_VALIDATION_ERROR = (
    "Key must start with a letter or underscore and contain only letters, digits, and underscores"
)

_SECRET_KEY_PATTERN = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")


def normalize_secret_key(key: str) -> str:
    """Normalize and validate a secret key shared by GraphQL and REST."""
    key = key.strip()
    if not key:
        raise ValueError("Key cannot be empty")
    if not _SECRET_KEY_PATTERN.fullmatch(key):
        raise ValueError(SECRET_KEY_VALIDATION_ERROR)
    return key
