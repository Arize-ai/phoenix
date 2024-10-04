import json
import os
from typing import Any, Dict, Iterator
from unittest import mock

import pytest
from phoenix.config import (
    ENV_PHOENIX_ENABLE_AUTH,
    get_env_smtp_hostname,
    get_env_smtp_password,
    get_env_smtp_port,
    get_env_smtp_username,
)
from portpicker import pick_unused_port  # type: ignore[import-untyped]
from smtpdfix import AuthController, Config, SMTPDFix
from smtpdfix.certs import _generate_certs

from .._helpers import _file_lock, _server


@pytest.fixture(scope="module")
def _environment(
    _environment_variables: Dict[str, str],
) -> Iterator[None]:
    values = (
        *_environment_variables.items(),
        (ENV_PHOENIX_ENABLE_AUTH, "true"),
    )
    with mock.patch.dict(os.environ, values):
        yield


@pytest.fixture(autouse=True, scope="module")
def _app(
    _environment: Any,
) -> Iterator[None]:
    with _server():
        yield


@pytest.fixture(scope="module")
def _smtpd(
    _app: Any,
    _email_domain: str,
    tmp_path_factory: pytest.TempPathFactory,
    worker_id: str,
) -> Iterator[AuthController]:
    port = get_env_smtp_port() if worker_id == "master" else pick_unused_port()
    with _file_lock() as f:
        ports = json.loads(f.read_text()) if f.is_file() else {}
        ports[_email_domain] = port
        f.write_text(json.dumps(ports))
    path = tmp_path_factory.mktemp("certs")
    cert, _ = _generate_certs(path, separate_key=False)
    os.environ["SMTPD_SSL_CERTIFICATE_FILE"] = str(cert.resolve())
    config = Config()
    config.login_username = get_env_smtp_username()
    config.login_password = get_env_smtp_password()
    config.use_starttls = True
    with SMTPDFix(
        hostname=get_env_smtp_hostname(),
        port=port,
        config=config,
    ) as controller:
        yield controller
