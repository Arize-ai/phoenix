from __future__ import annotations

from typing import Protocol

from phoenix.server.types import PasswordResetToken


class EmailSender(Protocol):
    async def send_password_reset_email(
        self,
        email: str,
        base_url: str,
        token: PasswordResetToken,
    ) -> None: ...
