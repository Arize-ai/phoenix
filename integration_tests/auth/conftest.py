import os
import secrets
from contextlib import ExitStack
from typing import Any, Iterator
from unittest import mock

import pytest
from faker import Faker
from phoenix.auth import DEFAULT_SECRET_LENGTH
from phoenix.config import (
    ENV_PHOENIX_ENABLE_AUTH,
    ENV_PHOENIX_SECRET,
    ENV_PHOENIX_SMTP_ENABLED,
    ENV_PHOENIX_SMTP_HOSTNAME,
    ENV_PHOENIX_SMTP_MAIL_FROM,
    ENV_PHOENIX_SMTP_PASSWORD,
    ENV_PHOENIX_SMTP_PORT,
    ENV_PHOENIX_SMTP_USERNAME,
    ENV_PHOENIX_SMTP_VALIDATE_CERTS,
)
from phoenix.server.email.types import SmtpConfig
from portpicker import pick_unused_port  # type: ignore[import-untyped]
from smtpdfix import AuthController, Config, SMTPDFix
from smtpdfix.certs import _generate_certs

from .._helpers import _Secret, _server


@pytest.fixture(scope="module")
def _secret() -> _Secret:
    return secrets.token_hex(DEFAULT_SECRET_LENGTH)


@pytest.fixture(scope="module")
def _smtp_config(_fake: Faker) -> SmtpConfig:
    return SmtpConfig(
        username="test",
        password="test",
        hostname="localhost",
        port=int(pick_unused_port()),
        mail_from=_fake.email(),
        validate_certs=False,
    )


@pytest.fixture(scope="module")
def _smtpd(
    _smtp_config: SmtpConfig,
    tmp_path_factory: pytest.TempPathFactory,
) -> Iterator[AuthController]:
    path = tmp_path_factory.mktemp("certs")
    cert, _ = _generate_certs(path, separate_key=False)
    os.environ["SMTPD_SSL_CERTIFICATE_FILE"] = str(cert.resolve())
    config = Config()
    config.login_username = _smtp_config.username
    config.login_password = _smtp_config.password
    config.use_starttls = True
    with SMTPDFix(
        hostname=_smtp_config.hostname,
        port=_smtp_config.port,
        config=config,
    ) as controller:
        yield controller


@pytest.fixture(autouse=True, scope="module")
def _app(
    _secret: _Secret,
    _env_phoenix_sql_database_url: Any,
    _smtp_config: SmtpConfig,
) -> Iterator[None]:
    values = (
        (ENV_PHOENIX_ENABLE_AUTH, "true"),
        (ENV_PHOENIX_SECRET, _secret),
        (ENV_PHOENIX_SMTP_ENABLED, "true"),
        (ENV_PHOENIX_SMTP_USERNAME, _smtp_config.username),
        (ENV_PHOENIX_SMTP_PASSWORD, _smtp_config.password),
        (ENV_PHOENIX_SMTP_MAIL_FROM, _smtp_config.mail_from),
        (ENV_PHOENIX_SMTP_HOSTNAME, str(_smtp_config.hostname)),
        (ENV_PHOENIX_SMTP_PORT, str(_smtp_config.port)),
        (ENV_PHOENIX_SMTP_VALIDATE_CERTS, str(_smtp_config.validate_certs)),
    )
    with ExitStack() as stack:
        stack.enter_context(mock.patch.dict(os.environ, values))
        stack.enter_context(_server())
        yield
