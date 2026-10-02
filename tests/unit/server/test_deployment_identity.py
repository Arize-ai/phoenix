import asyncio
from secrets import token_bytes

import pytest
from cryptography.fernet import InvalidToken
from pydantic import SecretStr
from sqlalchemy import func, select

from phoenix.db import models
from phoenix.server.deployment_identity import (
    REDACTION_KEY_PURPOSE,
    derive_deployment_key,
    load_deployment_seed,
)
from phoenix.server.redaction import Redactor
from phoenix.server.types import DbSessionFactory


async def test_load_deployment_seed_skips_insert_when_present(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    await load_deployment_seed(db)

    def fail(*args: object, **kwargs: object) -> None:
        raise AssertionError("insert")

    monkeypatch.setattr("phoenix.server.deployment_identity.insert_on_conflict", fail)
    assert len(await load_deployment_seed(db)) == 32


async def test_load_deployment_seed_converges(db: DbSessionFactory) -> None:
    seeds = await asyncio.gather(*(load_deployment_seed(db) for _ in range(8)))
    assert len(set(seeds)) == 1
    assert len(seeds[0]) == 32
    assert await load_deployment_seed(db) == seeds[0]
    async with db() as session:
        count = await session.scalar(select(func.count()).select_from(models.DeploymentIdentity))
    assert count == 1


def test_derive_deployment_key_separates_inputs() -> None:
    seed = b"\x01" * 32
    secret = SecretStr("secret")
    key = derive_deployment_key(seed=seed, secret=secret, purpose=REDACTION_KEY_PURPOSE)
    assert key == derive_deployment_key(seed=seed, secret=secret, purpose=REDACTION_KEY_PURPOSE)
    assert key != derive_deployment_key(seed=seed, secret=secret, purpose=b"phoenix/other/v1")
    assert key != derive_deployment_key(
        seed=b"\x02" * 32, secret=secret, purpose=REDACTION_KEY_PURPOSE
    )
    assert key != derive_deployment_key(
        seed=seed, secret=SecretStr("other"), purpose=REDACTION_KEY_PURPOSE
    )
    assert len(key) == 32


def test_redaction_without_phoenix_secret_requires_the_seed() -> None:
    seed = token_bytes(32)
    secret = SecretStr("")
    seeded = Redactor(
        derive_deployment_key(seed=seed, secret=secret, purpose=REDACTION_KEY_PURPOSE)
    )
    token = seeded.redact("sk-live-value")

    # An empty seed leaves the input keying material as the secret bytes alone.
    empty_secret_only = Redactor(
        derive_deployment_key(seed=b"", secret=secret, purpose=REDACTION_KEY_PURPOSE)
    )
    with pytest.raises(InvalidToken):
        empty_secret_only.unredact(token)

    peer = Redactor(derive_deployment_key(seed=seed, secret=secret, purpose=REDACTION_KEY_PURPOSE))
    assert peer.unredact(token) == "sk-live-value"
    assert seeded.unredact(peer.redact("sk-live-value")) == "sk-live-value"
