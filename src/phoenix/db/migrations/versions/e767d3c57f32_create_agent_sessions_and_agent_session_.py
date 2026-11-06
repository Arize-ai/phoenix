"""create agent session persistence tables

Revision ID: e767d3c57f32
Revises: c9d0e1f2a3b4
Create Date: 2026-07-08 15:16:23.608705

"""

from typing import Any, Literal, Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import JSON
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.compiler import compiles
from typing_extensions import TypeAlias, assert_never


class JSONB(JSON):
    __visit_name__ = "JSONB"


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(*args: Any, **kwargs: Any) -> str:
    return "JSONB"


JSON_ = (
    JSON()
    .with_variant(
        postgresql.JSONB(),
        "postgresql",
    )
    .with_variant(
        JSONB(),
        "sqlite",
    )
)

_Integer = sa.Integer().with_variant(
    sa.BigInteger(),
    "postgresql",
)

_UUID_GLOB = "-".join("[0-9a-fA-F]" * length for length in (8, 4, 4, 4, 12))
_UUID_REGEX = "^{}$".format("-".join(f"[0-9a-fA-F]{{{length}}}" for length in (8, 4, 4, 4, 12)))

_DialectName: TypeAlias = Literal["postgresql", "sqlite"]


def _bind_dialect_name() -> _DialectName:
    dialect_name = op.get_bind().dialect.name
    if dialect_name == "postgresql":
        return "postgresql"
    elif dialect_name == "sqlite":
        return "sqlite"
    raise RuntimeError(f"Unsupported SQL dialect: {dialect_name}")


def _uuid_format_check(column_name: str, dialect_name: _DialectName) -> str:
    """SQL for "this column holds a UUID in 8-4-4-4-12 hex form".

    SQLite has ``GLOB`` but no regex operator; PostgreSQL has ``~`` but no
    ``GLOB``, so the CHECK is spelled per-dialect.
    """
    if dialect_name == "postgresql":
        return f"{column_name} ~ '{_UUID_REGEX}'"
    elif dialect_name == "sqlite":
        return f"{column_name} GLOB '{_UUID_GLOB}'"
    assert_never(dialect_name)


# revision identifiers, used by Alembic.
revision: str = "e767d3c57f32"
down_revision: Union[str, None] = "c9d0e1f2a3b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agent_sessions",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column("project_name", sa.String, nullable=False),
        sa.Column(
            "user_id",
            _Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=True,  # sessions may be created while auth is disabled
        ),
        sa.Column("title", sa.String, nullable=False),
        sa.Column("model_provider", sa.String, nullable=False),
        sa.Column("model_name", sa.String, nullable=False),
        sa.Column(
            "custom_provider_id",
            _Integer,
            sa.ForeignKey(
                "generative_model_custom_providers.id",
                ondelete="SET NULL",
            ),
            nullable=True,
            index=True,
        ),
        sa.Column("is_ephemeral", sa.Boolean, nullable=False),
        sa.Column("heartbeat_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        sqlite_autoincrement=True,
    )
    op.create_index(
        "ix_agent_sessions_user_id_updated_at",
        "agent_sessions",
        ["user_id", sa.column("updated_at").desc()],
    )
    op.create_index(
        "ix_agent_sessions_ephemeral_updated_at",
        "agent_sessions",
        ["updated_at"],
        postgresql_where=sa.text("is_ephemeral IS TRUE"),
        sqlite_where=sa.text("is_ephemeral IS TRUE"),
    )
    op.create_index(
        "ix_agent_sessions_updated_at_id",
        "agent_sessions",
        ["updated_at", "id"],
    )

    message = sa.Column("message", JSON_, nullable=False)
    op.create_table(
        "agent_session_messages",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column(
            "agent_session_id",
            _Integer,
            sa.ForeignKey("agent_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        message,
        sa.Column(
            "message_id",
            sa.String,
            sa.Computed(message["id"].as_string(), persisted=True),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "is_compaction_message",
            sa.Boolean,
            sa.Computed(
                sa.func.coalesce(
                    message[["metadata", "phoenix", "isCompactionMessage"]].as_boolean(),
                    sa.false(),
                ),
                persisted=True,
            ),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        sa.CheckConstraint(
            _uuid_format_check("message_id", _bind_dialect_name()),
            name="valid_message_id",
        ),
        sqlite_autoincrement=True,
    )
    op.create_index(
        "ix_agent_session_messages_agent_session_id_id",
        "agent_session_messages",
        ["agent_session_id", "id"],
    )
    op.create_index(
        "ix_agent_session_messages_compaction",
        "agent_session_messages",
        ["agent_session_id", sa.column("id").desc()],
        postgresql_where=sa.text("is_compaction_message"),
        sqlite_where=sa.text("is_compaction_message"),
    )

    op.create_table(
        "agent_session_snapshots",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column(
            "agent_session_id",
            _Integer,
            sa.ForeignKey("agent_sessions.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("bashkit_snapshot", sa.LargeBinary, nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        sqlite_autoincrement=True,
    )


def downgrade() -> None:
    op.drop_table("agent_session_snapshots")
    op.drop_table("agent_session_messages")
    op.drop_table("agent_sessions")
