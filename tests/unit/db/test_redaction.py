from typing import Any

import pytest
from sqlalchemy import insert, select
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.exc import IntegrityError

from phoenix.db import models
from phoenix.db.redaction import redact_parameters
from phoenix.server.types import DbSessionFactory

DIALECTS = [
    pytest.param(postgresql.asyncpg.dialect(), id="postgresql"),  # type: ignore[no-untyped-call]
    pytest.param(sqlite.aiosqlite.dialect(), id="sqlite"),
]


def _positional(compiled: Any) -> tuple[Any, ...]:
    params = compiled.construct_params()
    return tuple(params[name] for name in compiled.positiontup)


@pytest.mark.parametrize("dialect", DIALECTS)
def test_marked_columns_are_blanked_in_comparisons(dialect: Dialect) -> None:
    compiled = (
        select(models.User)
        .where(models.User.email == "alice@example.com", models.User.id == 7)
        .compile(dialect=dialect)
    )
    assert redact_parameters(_positional(compiled), compiled, ismulti=False) == ("[redacted]", 7)
    assert redact_parameters(compiled.construct_params(), compiled, ismulti=False) == {
        "email_1": "[redacted]",
        "id_1": 7,
    }


@pytest.mark.parametrize("dialect", DIALECTS)
def test_marked_columns_are_blanked_in_every_row_of_an_insert(dialect: Dialect) -> None:
    compiled = (
        insert(models.User)
        .values(
            user_role_id=1,
            username="alice",
            email="alice@example.com",
            reset_password=False,
            auth_method="LOCAL",
        )
        .compile(dialect=dialect)
    )
    row = _positional(compiled)
    redacted_row = (1, "[redacted]", "[redacted]", False, "LOCAL")
    assert redact_parameters([row, row], compiled, ismulti=True) == [redacted_row, redacted_row]
    assert redact_parameters(row + row, compiled, ismulti=False) == redacted_row + redacted_row


def test_parameters_the_statement_cannot_account_for_are_hidden_entirely() -> None:
    compiled = (
        select(models.User)
        .where(models.User.id == 7, models.User.username == "alice")
        .compile(dialect=sqlite.dialect())
    )
    assert redact_parameters((7, "alice", "extra"), compiled, ismulti=False) is None
    assert redact_parameters((7, "alice"), None, ismulti=False) is None


@pytest.mark.postgres_only
async def test_integrity_error_text_omits_marked_values(db: DbSessionFactory) -> None:
    """SQLite errors reach callers unwrapped (the sqlean driver's exceptions are not the
    dialect's), so only PostgreSQL renders a parameter line to redact."""
    if db.dialect.name_literal != "postgresql":
        pytest.skip("SQLite errors carry no parameters")
    async with db() as session:
        role_id = await session.scalar(
            select(models.UserRole.id).where(models.UserRole.name == "MEMBER")
        )
        for username in ("alice", "alice-again"):
            session.add(
                models.User(
                    user_role_id=role_id,
                    username=username,
                    email="alice@example.com",
                    password_hash=b"hashed-hunter2",
                    password_salt=b"salty",
                    reset_password=False,
                    auth_method="LOCAL",
                )
            )
        with pytest.raises(IntegrityError) as excinfo:
            await session.flush()

    text = str(excinfo.value)
    assert "[parameters:" in text
    assert "[redacted]" in text
    assert "alice@example.com" not in text
    assert "alice-again" not in text
    assert "hunter2" not in text
    assert "LOCAL" in text
