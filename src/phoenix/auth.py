from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum, auto
from hashlib import pbkdf2_hmac
from typing import Optional, Protocol, Tuple, Union

from starlette.authentication import BaseUser
from typing_extensions import TypeAlias


def compute_password_hash(*, password: str, salt: str) -> str:
    """
    Salts and hashes a password using PBKDF2, HMAC, and SHA256.

    Args:
        password (str): the password to hash
        salt (str): the salt to use
    Returns:
        str: the hashed password
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

    Args:
        password (str): the password to validate
        salt (str): the salt to use
        password_hash (str): the hash to compare against
    Returns:
        bool: True if the password is valid, False otherwise
    """
    return password_hash == compute_password_hash(password=password, salt=salt)


def validate_email_format(email: str) -> None:
    """
    Checks that the email has a valid format.

    Args:
        email (str): the email address to validate
    Returns:
        None
    Raises:
        ValueError: if the email address is invalid
    """
    if EMAIL_PATTERN.match(email) is None:
        raise ValueError("Invalid email address")


def validate_password_format(password: str) -> None:
    """
    Checks that the password has a valid format.
    """
    PASSWORD_REQUIREMENTS.validate(password)


@dataclass(frozen=True)
class _PasswordRequirements:
    """
    Password must be at least `length` characters long. Password must not contain whitespace
    characters. Password can contain only ASCII characters. The arguments `special_chars`,
    `digits`, `upper_case`, and `lower_case` control what category of characters will appear
    in the password. If set to True, at least one character from the corresponding category
    is guaranteed to appear. Special characters are characters from `!@#$%^&*()_+`, digits
    are characters from `0123456789`, and uppercase and lowercase characters are characters
    from the ASCII set of letters.

    Attributes:
        length (int): the minimum length of the password
        special_chars (bool): whether the password must contain at least one special character
        digits (bool): whether the password must contain at least one digit
        upper_case (bool): whether the password must contain at least one uppercase letter
        lower_case (bool): whether the password must contain at least one lowercase letter
    """

    length: int
    special_chars: bool = False
    digits: bool = False
    upper_case: bool = False
    lower_case: bool = False

    def validate(self, password: str) -> None:
        """
        Validates the password against the requirements.

        Args:
            password (str): the password to validate
        Returns:
            None
        Raises:
            ValueError: if the password does not meet the requirements
        """
        if not password:
            raise ValueError("Password must be non-empty")
        if any(char.isspace() for char in password):
            raise ValueError("Password must not contain whitespace characters")
        if not password.isascii():
            raise ValueError("Password must contain only ASCII characters")
        if len(password) < self.length:
            raise ValueError(f"Password must be at least {self.length} characters long")
        if self.special_chars and not any(char in "!@#$%^&*()_+" for char in password):
            raise ValueError("Password must contain at least one special character")
        if self.digits and not any(char.isdigit() for char in password):
            raise ValueError("Password must contain at least one digit")
        if self.upper_case and not any(char.isupper() for char in password):
            raise ValueError("Password must contain at least one uppercase letter")
        if self.lower_case and not any(char.islower() for char in password):
            raise ValueError("Password must contain at least one lowercase letter")


"""The name of the header for token-based authentication"""
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+[.][^@\s]+\Z")
"""The regular expression pattern for a valid email address."""
NUM_ITERATIONS = 10_000
"""The number of iterations to use for the PBKDF2 key derivation function."""
MIN_PASSWORD_LENGTH = 4
"""The minimum length of a password."""
PASSWORD_REQUIREMENTS = _PasswordRequirements(MIN_PASSWORD_LENGTH)
"""The requirements for a valid password."""
REQUIREMENTS_FOR_PHOENIX_SECRET = _PasswordRequirements(32, True, True, True, True)
"""The requirements for the Phoenix secret key."""
JWT_ALGORITHM = "HS256"
"""The algorithm to use for the JSON Web Token."""
PHOENIX_ACCESS_TOKEN_COOKIE_NAME = "phoenix-access-token"
PHOENIX_ACCESS_TOKEN_COOKIE_MAX_AGE = timedelta(days=31)


class Issuer(Enum):
    API_KEY = auto()
    SESSION = auto()


class ClaimStatus(Enum):
    VALID = auto()
    INACTIVE = auto()
    EXPIRED = auto()


@dataclass(frozen=True)
class _BaseAttributes:
    user_role: str


@dataclass(frozen=True)
class ApiKeyAttributes(_BaseAttributes):
    name: Optional[str] = None
    description: Optional[str] = None


@dataclass(frozen=True)
class SessionAttributes(_BaseAttributes): ...


Attributes: TypeAlias = Union[ApiKeyAttributes, SessionAttributes]
TokenId: TypeAlias = str


@dataclass(frozen=True)
class Claim:
    token_id: Optional[TokenId] = None
    user_id: Optional[int] = None
    issuer: Optional[Issuer] = None
    issued_at: Optional[datetime] = None
    expiration_time: Optional[datetime] = None
    audience: Optional[str] = None
    attributes: Optional[Attributes] = None

    def __post_init__(self) -> None:
        if self.issuer is Issuer.API_KEY:
            assert isinstance(self.attributes, ApiKeyAttributes)
        elif self.issuer is Issuer.SESSION:
            assert isinstance(self.attributes, SessionAttributes)

    @property
    def status(self) -> ClaimStatus:
        if self.token_id is None:
            return ClaimStatus.INACTIVE
        if self.user_id is None:
            return ClaimStatus.INACTIVE
        if self.expiration_time and self.expiration_time < datetime.now(timezone.utc):
            return ClaimStatus.EXPIRED
        return ClaimStatus.VALID


Token: TypeAlias = str


class TokenStore(Protocol):
    async def create(self, claims: Claim) -> Tuple[Token, int]: ...
    async def read(self, token: Token) -> Claim: ...
    async def revoke(self, token_id: TokenId) -> None: ...


class PhoenixUser(BaseUser):
    def __init__(self, claim: Claim) -> None:
        self.claim = claim

    @property
    def is_authenticated(self) -> bool:
        return True
