from __future__ import annotations

from typing import Protocol


class WelcomeEmailSender(Protocol):
    async def send_welcome_email(
        self,
        email: str,
        name: str,
    ) -> None: ...


class PasswordResetEmailSender(Protocol):
    async def send_password_reset_email(
        self,
        email: str,
        reset_url: str,
    ) -> None: ...


class EmailSender(
    WelcomeEmailSender,
    PasswordResetEmailSender,
    Protocol,
): ...
