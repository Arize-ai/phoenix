import re
from hashlib import pbkdf2_hmac


def compute_password_hash(*, password: str, salt: str) -> str:
    """
    Salts and hashes a password using PBKDF2, HMAC, and SHA256.
    """
    password_bytes = password.encode("utf-8")
    salt_bytes = salt.encode("utf-8")
    password_hash_bytes = pbkdf2_hmac("sha256", password_bytes, salt_bytes, NUM_ITERATIONS)
    password_hash = password_hash_bytes.hex()
    return password_hash


def is_valid_password(*, password: str, salt: str, password_hash: str) -> bool:
    """
    Determines whether the password is valid by salting and hashing the password
    and comparing against the existing hash value.
    """
    return password_hash == compute_password_hash(password=password, salt=salt)


def validate_email_format(email: str) -> None:
    """
    Checks that the email has a valid format.
    """
    if EMAIL_PATTERN.match(email) is None:
        raise ValueError("Invalid email address")


def validate_password_format(password: str) -> None:
    """
    Checks that the password has a valid format.
    """
    if not password:
        raise ValueError("Password must be non-empty")
    if any(char.isspace() for char in password):
        raise ValueError("Password cannot contain whitespace characters")
    if not password.isascii():
        raise ValueError("Password can contain only ASCII characters")
    if not len(password) >= MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters long")


EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+[.][^@\s]+\Z")
NUM_ITERATIONS = 10_000
MIN_PASSWORD_LENGTH = 4
