from pathlib import Path

from fastapi_mail import ConnectionConfig, FastMail, MessageSchema

EMAIL_TEMPLATE_FOLDER = Path(__file__).parent / "templates"


class FastMailSender:
    def __init__(self, conf: ConnectionConfig) -> None:
        self._fm = FastMail(conf)

    async def send_password_reset_email(
        self,
        email: str,
        reset_url: str,
    ) -> None:
        message = MessageSchema(
            subject="[Phoenix] Password Reset Request",
            recipients=[email],
            template_body=dict(reset_url=reset_url),
            subtype="html",
        )
        await self._fm.send_message(
            message,
            template_name="password_reset.html",
        )
