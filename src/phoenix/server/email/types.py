from __future__ import annotations

from typing import Protocol


class EmailSender(Protocol):
    async def send_password_reset_email(
        self,
        email: str,
        reset_url: str,
    ) -> None: ...
