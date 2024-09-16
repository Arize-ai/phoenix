from pathlib import Path

from fastapi_mail import ConnectionConfig, FastMail, MessageSchema

from phoenix.config import get_base_url
from phoenix.server.email.types import SmtpConfig
from phoenix.server.types import PasswordResetToken

TEMPLATE_FOLDER = Path(__file__).parent


class FastMailSender:
    def __init__(self, smtp_config: SmtpConfig) -> None:
        self._stmp_config = smtp_config

    async def send_password_reset_email(
        self,
        email: str,
        token: PasswordResetToken,
    ) -> None:
        conf = ConnectionConfig(
            MAIL_USERNAME=self._stmp_config.username,
            MAIL_PASSWORD=self._stmp_config.password,
            MAIL_FROM=self._stmp_config.mail_from,
            MAIL_SERVER=self._stmp_config.hostname,
            MAIL_PORT=self._stmp_config.port,
            VALIDATE_CERTS=self._stmp_config.validate_certs,
            USE_CREDENTIALS=True,
            MAIL_STARTTLS=True,
            MAIL_SSL_TLS=False,
            TEMPLATE_FOLDER=TEMPLATE_FOLDER,
        )
        template_body = dict(
            token=token,
            base_url=get_base_url(),
            email=email,
        )
        message = MessageSchema(
            subject="Password Reset Request",
            recipients=[email],
            template_body=template_body,
            subtype="html",
        )
        fm = FastMail(conf)
        await fm.send_message(
            message,
            template_name="password_reset.html",
        )
