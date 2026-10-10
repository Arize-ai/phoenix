"""Tokens signed with the deployment seed are accepted only when Phoenix issued them."""

from __future__ import annotations

import pytest
from joserfc import jwt
from joserfc.jwk import OctKey
from pydantic import SecretStr

from phoenix.server.deployment_secret import TOKEN_SIGNING_KEY_PURPOSE, derive_deployment_key

from .._helpers import _ApiKey, _AppInfo, _deployment_seed_for_app, _httpx_client
from .conftest import _assert_issued_token_verifies_with_secret_configuration


def _derived_key(app: _AppInfo) -> OctKey:
    return OctKey.import_key(
        derive_deployment_key(
            seed=_deployment_seed_for_app(app),
            secret=SecretStr(""),
            purpose=TOKEN_SIGNING_KEY_PURPOSE,
        )
    )


def test_issued_token_verifies_with_the_expected_key(
    _app: _AppInfo, _secret_configuration: str
) -> None:
    _assert_issued_token_verifies_with_secret_configuration(_app, _secret_configuration)


@pytest.mark.parametrize(
    "app_fixture",
    [
        "_app_ldap_no_sign_up",
        "_app_ldap_posix",
        "_app_ldap_posix_memberuid",
        "_app_ldap_unique_id",
        "_app_ldap_no_email",
    ],
)
def test_ldap_app_verifies_with_the_expected_key(
    request: pytest.FixtureRequest,
    app_fixture: str,
    _secret_configuration: str,
) -> None:
    app = request.getfixturevalue(app_fixture)
    assert isinstance(app, _AppInfo)
    _assert_issued_token_verifies_with_secret_configuration(app, _secret_configuration)


def test_forged_token_for_existing_jti_is_rejected(
    _app: _AppInfo,
    _requires_derived_signing_key: None,
) -> None:
    key = _app.default_admin.log_in(_app).create_api_key(_app)
    signing_key = _derived_key(_app)
    issued = jwt.decode(str(key), signing_key)
    forged = jwt.encode({"alg": "HS256"}, {"jti": issued.claims["jti"]}, signing_key)
    rejected = _httpx_client(_app, _ApiKey(forged, key.gid)).get("v1/user")
    assert rejected.status_code == 401
    assert _httpx_client(_app, key).get("v1/user").status_code == 200
