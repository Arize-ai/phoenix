from __future__ import annotations

from typing import Protocol

from phoenix.server.email.templates.types import PasswordResetTemplateBody


class EmailSender(Protocol):
    async def send_password_reset_email(
        self,
        email: str,
        values: PasswordResetTemplateBody,
    ) -> None: ...
