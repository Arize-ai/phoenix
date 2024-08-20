import re
from hashlib import pbkdf2_hmac

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.exceptions import PhoenixException


def compute_password_hash(*, password: str, salt: str) -> str:
    """
    Salts and hashes a password using PBKDF2, HMAC, and SHA256.
    """
    password_bytes = password.encode("utf-8")
    salt_bytes = salt.encode("utf-8")
    password_hash_bytes = pbkdf2_hmac("sha256", password_bytes, salt_bytes, NUM_ITERATIONS)
    password_hash = password_hash_bytes.hex()
    return password_hash


async def validate_login_credentials(
    *, session: AsyncSession, email: str, password: str, salt: str
) -> None:
    """
    Validates login credentials by computing the password hash and comparing
    against the password hash stored in the database.
    """
    if (
        user := await session.scalar(select(models.User).where(models.User.email == email))
    ) is None:
        raise FailedLoginError
    assert user.email == email
    password_hash = compute_password_hash(password=password, salt=salt)
    if user.password_hash != password_hash:
        raise FailedLoginError


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


class FailedLoginError(PhoenixException):
    """
    Exception raised when login fails.
    """


EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+[.][^@\s]+\Z")
NUM_ITERATIONS = 10_000
