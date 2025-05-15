import smtplib
import ssl
from email.message import EmailMessage
from pathlib import Path
from typing import Literal
from urllib.parse import urljoin

from anyio import to_thread
from jinja2 import Environment, FileSystemLoader, select_autoescape
from typing_extensions import TypeAlias

from phoenix.config import get_env_root_url

EMAIL_TEMPLATE_FOLDER = Path(__file__).parent / "templates"

ConnectionMethod: TypeAlias = Literal["STARTTLS", "SSL", "PLAIN"]


class SimpleEmailSender:
    def __init__(
        self,
        smtp_server: str,
        smtp_port: int,
        username: str,
        password: str,
        sender_email: str,
        connection_method: ConnectionMethod = "STARTTLS",
        validate_certs: bool = True,
    ) -> None:
        self.smtp_server = smtp_server
        self.smtp_port = smtp_port
        self.username = username
        self.password = password
        self.sender_email = sender_email
        self.connection_method: ConnectionMethod = connection_method
        self.validate_certs = validate_certs

        self.env = Environment(
            loader=FileSystemLoader(EMAIL_TEMPLATE_FOLDER),
            autoescape=select_autoescape(["html", "xml"]),
        )

    async def send_welcome_email(
        self,
        email: str,
        name: str,
    ) -> None:
        subject = "[Phoenix] Welcome to Arize Phoenix"
        template_name = "welcome.html"

        template = self.env.get_template(template_name)
        html_content = template.render(
            name=name,
            welcome_url=urljoin(str(get_env_root_url()), "forgot-password"),
        )

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = self.sender_email
        msg["To"] = email
        msg.set_content(html_content, subtype="html")

        await to_thread.run_sync(self._send_email, msg)

    async def send_password_reset_email(
        self,
        email: str,
        reset_url: str,
    ) -> None:
        subject = "[Phoenix] Password Reset Request"
        template_name = "password_reset.html"

        template = self.env.get_template(template_name)
        html_content = template.render(reset_url=reset_url)

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = self.sender_email
        msg["To"] = email
        msg.set_content(html_content, subtype="html")

        await to_thread.run_sync(self._send_email, msg)

    def _send_email(self, msg: EmailMessage) -> None:
        context: ssl.SSLContext
        if self.validate_certs:
            context = ssl.create_default_context()
        else:
            context = ssl._create_unverified_context()

        methods_to_try: list[ConnectionMethod] = [self.connection_method]
        # add secure method fallbacks
        if self.connection_method != "PLAIN":
            if self.connection_method != "STARTTLS":
                methods_to_try.append("STARTTLS")
            if self.connection_method != "SSL":
                methods_to_try.append("SSL")

        for method in methods_to_try:
            try:
                if method == "STARTTLS":
                    server = smtplib.SMTP(self.smtp_server, self.smtp_port)
                    server.ehlo()
                    server.starttls(context=context)
                    server.ehlo()
                elif method == "SSL":
                    server = smtplib.SMTP_SSL(self.smtp_server, self.smtp_port, context=context)
                    server.ehlo()
                elif method == "PLAIN":
                    server = smtplib.SMTP(self.smtp_server, self.smtp_port)
                    server.ehlo()
                else:
                    continue  # Unsupported method

                if self.username and self.password:
                    server.login(self.username, self.password)

                server.send_message(msg)
                server.quit()
                break  # Success
            except Exception as e:
                print(f"Failed to send email using {method}: {e}")
                continue
        else:
            raise Exception("All connection methods failed")
