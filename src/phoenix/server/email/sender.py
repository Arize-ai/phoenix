from dataclasses import asdict
from pathlib import Path

from fastapi_mail import ConnectionConfig, FastMail, MessageSchema

from phoenix.server.email.templates.types import PasswordResetTemplateBody

EMAIL_TEMPLATE_FOLDER = Path(__file__).parent / "templates"


class FastMailSender:
    def __init__(self, conf: ConnectionConfig) -> None:
        self._fm = FastMail(conf)

    async def send_password_reset_email(
        self,
        email: str,
        values: PasswordResetTemplateBody,
    ) -> None:
        message = MessageSchema(
            subject="Password Reset Request",
            recipients=[email],
            template_body=asdict(values),
            subtype="html",
        )
        await self._fm.send_message(
            message,
            template_name="password_reset.html",
        )
