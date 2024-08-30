from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum, auto
from hashlib import pbkdf2_hmac
from typing import Any, Literal, Optional, Protocol

from fastapi import Response


def compute_password_hash(*, password: str, salt: bytes) -> bytes:
    """
    Salts and hashes a password using PBKDF2, HMAC, and SHA256.

    Args:
        password (str): the password to hash
        salt (bytes): the salt to use, must not be zero-length
    Returns:
        bytes: the hashed password
    """
    assert salt
    password_bytes = password.encode("utf-8")
    return pbkdf2_hmac("sha256", password_bytes, salt, NUM_ITERATIONS)


def is_valid_password(*, password: str, salt: bytes, password_hash: bytes) -> bool:
    """
    Determines whether the password is valid by salting and hashing the password
    and comparing against the existing hash value.

    Args:
        password (str): the password to validate
        salt (bytes): the salt to use, must not be zero-length
        password_hash (bytes): the hash to compare against
    Returns:
        bool: True if the password is valid, False otherwise
    """
    assert salt
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


def set_access_token_cookie(response: Response, access_token: str) -> Response:
    return _set_token_cookie(
        response=response,
        cookie_name=PHOENIX_ACCESS_TOKEN_COOKIE_NAME,
        cookie_max_age=PHOENIX_ACCESS_TOKEN_MAX_AGE,
        token=access_token,
    )


def set_refresh_token_cookie(response: Response, refresh_token: str) -> Response:
    return _set_token_cookie(
        response=response,
        cookie_name=PHOENIX_REFRESH_TOKEN_COOKIE_NAME,
        cookie_max_age=PHOENIX_REFRESH_TOKEN_MAX_AGE,
        token=refresh_token,
    )


def _set_token_cookie(
    response: Response, cookie_name: str, cookie_max_age: timedelta, token: str
) -> Response:
    response.set_cookie(
        key=cookie_name,
        value=token,
        secure=True,
        httponly=True,
        samesite="strict",
        max_age=int(cookie_max_age.total_seconds()),
    )
    return response


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
        digits (bool): whether the password must contain at least one digit
        lower_case (bool): whether the password must contain at least one lowercase letter
        upper_case (bool): whether the password must contain at least one uppercase letter
        special_chars (bool): whether the password must contain at least one special character
    """

    length: int
    digits: bool = False
    lower_case: bool = False
    upper_case: bool = False
    special_chars: bool = False

    def validate(
        self,
        string: str,
        /,
        err_msg_subject: Literal["Password", "Phoenix secret"] = "Password",
    ) -> None:
        """
        Validates the password against the requirements.

        Args:
            string (str): the password to validate
            err_msg_subject (str, optional): the subject of the error message,
                defaults to "Password"
        Returns:
            None
        Raises:
            ValueError: if the password does not meet the requirements
        """
        if not string:
            raise ValueError(f"{err_msg_subject} must be non-empty")
        if any(char.isspace() for char in string):
            raise ValueError(f"{err_msg_subject} must not contain whitespace characters")
        if not string.isascii():
            raise ValueError(f"{err_msg_subject} must contain only ASCII characters")
        err_msg = []
        if len(string) < self.length:
            err_msg.append(f"must be at least {self.length} characters long")
        if self.digits and not any(char.isdigit() for char in string):
            err_msg.append("at least one digit")
        if self.lower_case and not any(char.islower() for char in string):
            err_msg.append("at least one lowercase letter")
        if self.upper_case and not any(char.isupper() for char in string):
            err_msg.append("at least one uppercase letter")
        if self.special_chars and not any(char in "!@#$%^&*()_+" for char in string):
            err_msg.append("at least one special character")
        if not err_msg:
            return
        if len(err_msg) > 1:
            err_text = f"{err_msg_subject} " + ", ".join(err_msg[:-1]) + ", and " + err_msg[-1]
        else:
            err_text = f"{err_msg_subject} {err_msg[0]}"
        raise ValueError(err_text)


DEFAULT_SECRET_LENGTH = 32
"""The default length of a secret key in bytes."""
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+[.][^@\s]+\Z")
"""The regular expression pattern for a valid email address."""
NUM_ITERATIONS = 10_000
"""The number of iterations to use for the PBKDF2 key derivation function."""
MIN_PASSWORD_LENGTH = 4
"""The minimum length of a password."""
PASSWORD_REQUIREMENTS = _PasswordRequirements(length=MIN_PASSWORD_LENGTH)
"""The requirements for a valid password."""
REQUIREMENTS_FOR_PHOENIX_SECRET = _PasswordRequirements(
    length=DEFAULT_SECRET_LENGTH, digits=True, lower_case=True
)
"""The requirements for the Phoenix secret key."""
JWT_ALGORITHM = "HS256"
"""The algorithm to use for the JSON Web Token."""
PHOENIX_ACCESS_TOKEN_COOKIE_NAME = "phoenix-access-token"
"""The name of the cookie that stores the Phoenix access token."""
PHOENIX_ACCESS_TOKEN_MAX_AGE = timedelta(minutes=11)
"""The maximum age of the Phoenix access token."""
PHOENIX_REFRESH_TOKEN_COOKIE_NAME = "phoenix-refresh-token"
"""The name of the cookie that stores the Phoenix refresh token."""
PHOENIX_REFRESH_TOKEN_MAX_AGE = timedelta(days=1)


class Token(str): ...


class ClaimSetStatus(Enum):
    VALID = auto()
    INVALID = auto()
    EXPIRED = auto()


@dataclass(frozen=True)
class TokenAttributes: ...


@dataclass(frozen=True)
class ClaimSet:
    issuer: Optional[Any] = None
    "Analog of `iss` claim in JWT RFC7519: https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.1"
    subject: Optional[Any] = None
    "Analog of `sub` claim in JWT RFC7519: https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.2"
    audience: Optional[Any] = None
    "Analog of `aud` claim in JWT RFC7519: https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.3"
    not_before: Optional[datetime] = None
    "Analog of `nbf` claim in JWT RFC7519: https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.5"
    issued_at: Optional[datetime] = None
    "Analog of `iat` claim in JWT RFC7519: https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.6"
    expiration_time: Optional[datetime] = None
    "Analog of `exp` claim in JWT RFC7519: https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.4"
    token_id: Optional[Any] = None
    "Analog of `jti` claim in JWT RFC7519: https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.7"
    attributes: Optional[TokenAttributes] = None
    "Application/domain-specific claims"

    @property
    def status(self) -> ClaimSetStatus:
        if self.expiration_time and self.expiration_time.timestamp() < datetime.now().timestamp():
            return ClaimSetStatus.EXPIRED
        if self.token_id is not None and self.subject is not None:
            return ClaimSetStatus.VALID
        return ClaimSetStatus.INVALID


class CanReadToken(Protocol):
    async def read(self, token: Token) -> Optional[ClaimSet]: ...
