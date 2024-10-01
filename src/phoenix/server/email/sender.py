import asyncio
import smtplib
import ssl
from email.message import EmailMessage
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

EMAIL_TEMPLATE_FOLDER = Path(__file__).parent / "templates"


class SimpleEmailSender:
    def __init__(
        self,
        smtp_server: str,
        smtp_port: int,
        username: str,
        password: str,
        sender_email: str,
        use_tls: bool = True,
        validate_certs: bool = True,
    ) -> None:
        self.smtp_server = smtp_server
        self.smtp_port = smtp_port
        self.username = username
        self.password = password
        self.sender_email = sender_email
        self.use_tls = use_tls
        self.validate_certs = validate_certs

        self.env = Environment(
            loader=FileSystemLoader(EMAIL_TEMPLATE_FOLDER),
            autoescape=select_autoescape(["html", "xml"]),
        )

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

        def send_email():
            if self.validate_certs:
                context: ssl.SSLContext = ssl.create_default_context()
            else:
                context: ssl.SSLContext = ssl._create_unverified_context()

            if self.use_tls:
                server = smtplib.SMTP(self.smtp_server, self.smtp_port)
                server.starttls(context=context)
            else:
                server = smtplib.SMTP_SSL(self.smtp_server, self.smtp_port, context=context)

            server.login(self.username, self.password)
            server.send_message(msg)
            server.quit()

        await asyncio.to_thread(send_email)
