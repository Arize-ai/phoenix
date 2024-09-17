from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from phoenix.config import (
    get_env_smtp_hostname,
    get_env_smtp_mail_from,
    get_env_smtp_password,
    get_env_smtp_port,
    get_env_smtp_username,
    get_env_smtp_validate_certs,
)
from phoenix.server.types import PasswordResetToken


@dataclass(frozen=True)
class SmtpConfig:
    username: str
    password: str
    hostname: str
    port: int
    mail_from: str
    validate_certs: bool

    @classmethod
    def from_env(cls) -> SmtpConfig:
        assert (username := get_env_smtp_username()) is not None
        assert (password := get_env_smtp_password()) is not None
        assert (hostname := get_env_smtp_hostname()) is not None
        assert (port := get_env_smtp_port()) is not None
        assert (mail_from := get_env_smtp_mail_from()) is not None
        return cls(
            username=username,
            password=password,
            hostname=hostname,
            port=int(port),
            mail_from=mail_from,
            validate_certs=get_env_smtp_validate_certs(),
        )


class EmailSender(Protocol):
    async def send_password_reset_email(
        self,
        email: str,
        token: PasswordResetToken,
    ) -> None: ...
