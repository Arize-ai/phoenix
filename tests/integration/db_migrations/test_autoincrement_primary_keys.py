"""
Tests to ensure autoincrement behavior is preserved for tables with sqlite_autoincrement=True.

SQLite batch_alter_table operations can silently reset the autoincrement counter if not
configured with sqlite_autoincrement=True. These tests verify that after deleting a row
and inserting a new one, the new ID is strictly greater than the deleted ID.

Tables tested:
- users
- password_reset_tokens
- refresh_tokens
- access_tokens
- api_keys
- prompt_versions
"""

from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Callable, Type

from alembic.config import Config
from sqlalchemy import Engine, select, text
from sqlalchemy.orm import Session, sessionmaker

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.helpers.prompts.models import (
    PromptChatTemplate,
    PromptOpenAIInvocationParameters,
    PromptOpenAIInvocationParametersContent,
)

from . import _up


def _create_user_role(engine: Engine, name: str) -> int:
    """Create a user role and return its ID."""
    with engine.connect() as conn:
        role_id = conn.execute(
            text(f"INSERT INTO user_roles (name) VALUES ('{name}') RETURNING id")
        ).scalar()
        conn.commit()
    assert isinstance(role_id, int)
    return role_id


def _assert_autoincrement_preserved(
    db: "sessionmaker[Session]",
    model_class: Type[models.HasId],
    create_instance: Callable[[], models.HasId],
    id_attr: str = "id",
) -> None:
    """
    Helper to test autoincrement behavior.

    Creates an instance, deletes it, creates another, and verifies the new ID is greater.
    """
    # Create first instance
    with db.begin() as session:
        instance1 = create_instance()
        assert getattr(instance1, id_attr) is None
        session.add(instance1)
    id1 = getattr(instance1, id_attr)
    assert id1 is not None

    # Verify it exists
    with db.begin() as session:
        assert (
            session.scalar(select(getattr(model_class, id_attr)).filter_by(**{id_attr: id1}))
            is not None
        )

    # Delete it
    with db.begin() as session:
        session.delete(instance1)

    # Verify it's gone
    with db.begin() as session:
        assert (
            session.scalar(select(getattr(model_class, id_attr)).filter_by(**{id_attr: id1}))
            is None
        )

    # Create second instance
    with db.begin() as session:
        instance2 = create_instance()
        assert getattr(instance2, id_attr) is None
        session.add(instance2)
    id2 = getattr(instance2, id_attr)

    # Verify autoincrement: new ID must be greater than deleted ID
    assert id2 > id1, (
        f"Autoincrement violated for {model_class.__tablename__}: "
        f"new id {id2} should be > deleted id {id1}"
    )


def test_users_autoincrement(
    _engine: Engine,
    _alembic_config: Config,
    _schema: str,
) -> None:
    """Test that users table preserves autoincrement behavior."""
    _up(_engine, _alembic_config, "head", _schema)
    db = sessionmaker(bind=_engine, expire_on_commit=False)

    # Create admin role (migrations don't seed user_roles)
    role_id = _create_user_role(_engine, "ADMIN")

    counter = [0]

    def create_user() -> models.LocalUser:
        counter[0] += 1
        return models.LocalUser(
            email=f"test{counter[0]}_{token_hex(8)}@example.com",
            username=f"testuser{counter[0]}_{token_hex(8)}",
            password_hash=b"hash",
            password_salt=b"salt",
            user_role_id=role_id,
        )

    _assert_autoincrement_preserved(db, models.User, create_user)


def test_password_reset_tokens_autoincrement(
    _engine: Engine,
    _alembic_config: Config,
    _schema: str,
) -> None:
    """Test that password_reset_tokens table preserves autoincrement behavior."""
    _up(_engine, _alembic_config, "head", _schema)
    db = sessionmaker(bind=_engine, expire_on_commit=False)

    # Create admin role and user for the tokens
    role_id = _create_user_role(_engine, "ADMIN")
    with db.begin() as session:
        user = models.LocalUser(
            email=f"prt_test_{token_hex(8)}@example.com",
            username=f"prt_user_{token_hex(8)}",
            password_hash=b"hash",
            password_salt=b"salt",
            user_role_id=role_id,
        )
        session.add(user)
    user_id = user.id

    def create_token() -> models.PasswordResetToken:
        return models.PasswordResetToken(
            user_id=user_id,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )

    _assert_autoincrement_preserved(db, models.PasswordResetToken, create_token)


def test_refresh_tokens_autoincrement(
    _engine: Engine,
    _alembic_config: Config,
    _schema: str,
) -> None:
    """Test that refresh_tokens table preserves autoincrement behavior."""
    _up(_engine, _alembic_config, "head", _schema)
    db = sessionmaker(bind=_engine, expire_on_commit=False)

    # Create admin role and user for the tokens
    role_id = _create_user_role(_engine, "ADMIN")
    with db.begin() as session:
        user = models.LocalUser(
            email=f"rt_test_{token_hex(8)}@example.com",
            username=f"rt_user_{token_hex(8)}",
            password_hash=b"hash",
            password_salt=b"salt",
            user_role_id=role_id,
        )
        session.add(user)
    user_id = user.id

    def create_token() -> models.RefreshToken:
        return models.RefreshToken(
            user_id=user_id,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )

    _assert_autoincrement_preserved(db, models.RefreshToken, create_token)


def test_access_tokens_autoincrement(
    _engine: Engine,
    _alembic_config: Config,
    _schema: str,
) -> None:
    """Test that access_tokens table preserves autoincrement behavior."""
    _up(_engine, _alembic_config, "head", _schema)
    db = sessionmaker(bind=_engine, expire_on_commit=False)

    # Create admin role and user for the access tokens
    role_id = _create_user_role(_engine, "ADMIN")
    with db.begin() as session:
        user = models.LocalUser(
            email=f"at_test_{token_hex(8)}@example.com",
            username=f"at_user_{token_hex(8)}",
            password_hash=b"hash",
            password_salt=b"salt",
            user_role_id=role_id,
        )
        session.add(user)
    user_id = user.id

    # Need a new refresh token for each access token (unique constraint)
    refresh_token_ids = []
    for _ in range(2):
        with db.begin() as session:
            refresh_token = models.RefreshToken(
                user_id=user_id,
                expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            )
            session.add(refresh_token)
        refresh_token_ids.append(refresh_token.id)

    counter = [0]

    def create_token() -> models.AccessToken:
        rt_id = refresh_token_ids[counter[0]]
        counter[0] += 1
        return models.AccessToken(
            user_id=user_id,
            refresh_token_id=rt_id,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )

    _assert_autoincrement_preserved(db, models.AccessToken, create_token)


def test_api_keys_autoincrement(
    _engine: Engine,
    _alembic_config: Config,
    _schema: str,
) -> None:
    """Test that api_keys table preserves autoincrement behavior."""
    _up(_engine, _alembic_config, "head", _schema)
    db = sessionmaker(bind=_engine, expire_on_commit=False)

    # Create admin role and user for the API keys
    role_id = _create_user_role(_engine, "ADMIN")
    with db.begin() as session:
        user = models.LocalUser(
            email=f"ak_test_{token_hex(8)}@example.com",
            username=f"ak_user_{token_hex(8)}",
            password_hash=b"hash",
            password_salt=b"salt",
            user_role_id=role_id,
        )
        session.add(user)
    user_id = user.id

    counter = [0]

    def create_api_key() -> models.ApiKey:
        counter[0] += 1
        return models.ApiKey(
            user_id=user_id,
            name=f"test_key_{counter[0]}_{token_hex(8)}",
        )

    _assert_autoincrement_preserved(db, models.ApiKey, create_api_key)


def test_prompt_versions_autoincrement(
    _engine: Engine,
    _alembic_config: Config,
    _schema: str,
) -> None:
    """
    Test that prompt_versions table preserves autoincrement behavior.

    Note: prompt_versions gained sqlite_autoincrement=True in migration 02463bd83119
    to ensure batch_alter_table operations preserve ID monotonicity.
    """
    _up(_engine, _alembic_config, "head", _schema)
    db = sessionmaker(bind=_engine, expire_on_commit=False)

    # Create a prompt for the versions
    with db.begin() as session:
        name = Identifier.model_validate(token_hex(16))
        prompt = models.Prompt(name=name)
        session.add(prompt)
    prompt_id = prompt.id

    def create_prompt_version() -> models.PromptVersion:
        return models.PromptVersion(
            prompt_id=prompt_id,
            template=PromptChatTemplate(type="chat", messages=[]),
            template_type="CHAT",
            template_format="MUSTACHE",
            model_provider=ModelProvider.OPENAI,
            model_name=token_hex(16),
            invocation_parameters=PromptOpenAIInvocationParameters(
                type="openai",
                openai=PromptOpenAIInvocationParametersContent(
                    temperature=0.5,
                ),
            ),
        )

    _assert_autoincrement_preserved(db, models.PromptVersion, create_prompt_version)
