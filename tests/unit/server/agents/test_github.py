from __future__ import annotations

import pytest
from pydantic import SecretStr

from phoenix.db import models
from phoenix.server.agents.github import GITHUB_PAT_SECRET_KEY, resolve_github_token
from phoenix.server.encryption import EncryptionService
from phoenix.server.types import DbSessionFactory


@pytest.fixture
def encryption() -> EncryptionService:
    return EncryptionService()


@pytest.fixture
async def stored_workspace_token(
    db: DbSessionFactory,
    encryption: EncryptionService,
) -> str:
    token = "ghp_workspace"
    async with db() as session:
        session.add(
            models.Secret(key=GITHUB_PAT_SECRET_KEY, value=encryption.encrypt(token.encode()))
        )
    return token


class TestResolveGithubToken:
    async def test_request_credential_wins_over_workspace_secret_and_env(
        self,
        db: DbSessionFactory,
        encryption: EncryptionService,
        stored_workspace_token: str,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setenv(GITHUB_PAT_SECRET_KEY, "ghp_env")
        async with db() as session:
            token = await resolve_github_token(
                session,
                encryption.decrypt,
                {GITHUB_PAT_SECRET_KEY: SecretStr("ghp_personal")},
            )
        assert token is not None
        assert token.get_secret_value() == "ghp_personal"

    async def test_workspace_secret_wins_over_env(
        self,
        db: DbSessionFactory,
        encryption: EncryptionService,
        stored_workspace_token: str,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setenv(GITHUB_PAT_SECRET_KEY, "ghp_env")
        async with db() as session:
            token = await resolve_github_token(session, encryption.decrypt, {})
        assert token is not None
        assert token.get_secret_value() == stored_workspace_token

    async def test_env_is_the_last_fallback(
        self,
        db: DbSessionFactory,
        encryption: EncryptionService,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setenv(GITHUB_PAT_SECRET_KEY, "ghp_env")
        async with db() as session:
            token = await resolve_github_token(session, encryption.decrypt, {})
        assert token is not None
        assert token.get_secret_value() == "ghp_env"

    async def test_no_configuration_resolves_to_none(
        self,
        db: DbSessionFactory,
        encryption: EncryptionService,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.delenv(GITHUB_PAT_SECRET_KEY, raising=False)
        async with db() as session:
            token = await resolve_github_token(session, encryption.decrypt, {})
        assert token is None

    async def test_empty_request_credential_falls_through(
        self,
        db: DbSessionFactory,
        encryption: EncryptionService,
        stored_workspace_token: str,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.delenv(GITHUB_PAT_SECRET_KEY, raising=False)
        async with db() as session:
            token = await resolve_github_token(
                session,
                encryption.decrypt,
                {GITHUB_PAT_SECRET_KEY: SecretStr("")},
            )
        assert token is not None
        assert token.get_secret_value() == stored_workspace_token

    async def test_undecryptable_workspace_secret_falls_back_to_env(
        self,
        db: DbSessionFactory,
        encryption: EncryptionService,
        stored_workspace_token: str,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setenv(GITHUB_PAT_SECRET_KEY, "ghp_env")

        def decrypt_fails(_: bytes) -> bytes:
            raise ValueError("decrypt failed")

        async with db() as session:
            token = await resolve_github_token(session, decrypt_fails, {})
        assert token is not None
        assert token.get_secret_value() == "ghp_env"
