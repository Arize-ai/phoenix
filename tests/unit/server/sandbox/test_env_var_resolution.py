from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from phoenix.server.sandbox import SecretsContext
from phoenix.server.sandbox.e2b_backend import E2BAdapter
from phoenix.server.sandbox.types import EnvVarValue


def _make_session(secrets: dict[str, bytes]) -> Any:
    rows = []
    for key, value in secrets.items():
        row = MagicMock()
        row.key = key
        row.value = value
        rows.append(row)

    scalars_mock = MagicMock()
    scalars_mock.all.return_value = rows

    session = MagicMock()
    session.scalars = AsyncMock(return_value=scalars_mock)
    return session


def _identity_decrypt(data: bytes) -> bytes:
    return data


class TestResolveUserEnvShape:
    @pytest.mark.asyncio
    async def test_secret_refs_resolve_into_expected_shape(self) -> None:
        env_vars = {
            "FIRST": EnvVarValue(secret_key="first-key"),
            "SECOND": EnvVarValue(secret_key="second-key"),
        }
        session = _make_session({"first-key": b"hello", "second-key": b"world"})
        secrets = SecretsContext(session=session, decrypt=_identity_decrypt)
        result = await secrets.resolve_user_env(env_vars)
        assert result == {"FIRST": "hello", "SECOND": "world"}


class TestEnvVarsAcceptedAndPersisted:
    def test_unique_env_vars_pass_and_persist(self) -> None:
        adapter = E2BAdapter()
        config = {
            "env_vars": {
                "A": {"secret_key": "key-1"},
                "B": {"secret_key": "key-2"},
            },
        }
        result = adapter.config_model.model_validate({**config, "language": "PYTHON"})
        assert len(result.env_vars) == 2
        a = result.env_vars["A"]
        b = result.env_vars["B"]
        assert a.secret_key == "key-1"
        assert b.secret_key == "key-2"
