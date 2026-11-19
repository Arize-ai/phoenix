from contextlib import asynccontextmanager
from typing import Any

import pytest

from phoenix.db import models
from phoenix.server.api.dataloaders.users import UsersDataLoader
from phoenix.server.api.dataloaders.version_authors import VersionAuthorsDataLoader

_SENSITIVE_COLUMNS = (
    "password_hash",
    "password_salt",
    "oauth2_client_id",
    "oauth2_user_id",
    "ldap_unique_id",
)


class _CapturingSession:
    def __init__(self, captured: list[str]) -> None:
        self._captured = captured

    async def stream_scalars(self, stmt: Any) -> Any:
        self._captured.append(str(stmt.compile()))

        async def _empty() -> Any:
            if False:
                yield None

        return _empty()

    async def stream(self, stmt: Any) -> Any:
        self._captured.append(str(stmt.compile()))

        async def _empty() -> Any:
            if False:
                yield None

        return _empty()


class _CapturingDb:
    def __init__(self, captured: list[str]) -> None:
        self._captured = captured

    @asynccontextmanager
    async def read(self) -> Any:
        yield _CapturingSession(self._captured)


@pytest.mark.asyncio
async def test_users_dataloader_excludes_sensitive_columns() -> None:
    captured: list[str] = []
    loader = UsersDataLoader(_CapturingDb(captured))  # type: ignore[arg-type]

    result = await loader._load_fn([1, 2])
    assert result == [None, None]
    assert len(captured) == 1
    sql = captured[0]
    for col in _SENSITIVE_COLUMNS:
        assert col not in sql, f"UsersDataLoader should not select {col}"
    assert "username" in sql
    assert "email" in sql
    assert "auth_method" in sql


@pytest.mark.asyncio
@pytest.mark.parametrize("resolve_created_by", [True, False])
async def test_version_authors_dataloader_excludes_sensitive_columns(
    resolve_created_by: bool,
) -> None:
    captured: list[str] = []
    loader = VersionAuthorsDataLoader(
        _CapturingDb(captured),  # type: ignore[arg-type]
        models.PromptVersion,
        models.PromptVersion.prompt_id,
        resolve_created_by=resolve_created_by,
    )

    result = await loader._load_fn([10])
    assert len(result) == 1
    assert len(captured) == 1
    sql = captured[0]
    for col in _SENSITIVE_COLUMNS:
        assert col not in sql, f"VersionAuthorsDataLoader should not select {col}"
    assert "username" in sql
    assert "email" in sql
    assert "auth_method" in sql
