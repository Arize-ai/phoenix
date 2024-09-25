from pathlib import Path
from urllib.parse import ParseResult, urlencode, urlparse, urlunparse

from fastapi_mail import ConnectionConfig, FastMail, MessageSchema

from phoenix.config import get_env_host_root_path
from phoenix.server.types import PasswordResetToken

EMAIL_TEMPLATE_FOLDER = Path(__file__).parent / "templates"


class FastMailSender:
    def __init__(self, conf: ConnectionConfig) -> None:
        self._fm = FastMail(conf)

    async def send_password_reset_email(
        self,
        email: str,
        base_url: str,
        token: PasswordResetToken,
    ) -> None:
        base: ParseResult = urlparse(base_url)
        path = Path(get_env_host_root_path()) / "reset-password-with-token"
        query_string = urlencode(dict(token=token))
        components = (base.scheme, base.netloc, path.as_posix(), "", query_string, "")
        reset_url = urlunparse(components)
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
