"""create agent session persistence tables

Revision ID: e767d3c57f32
Revises: eaf1907ae453
Create Date: 2026-07-08 15:16:23.608705

"""

from typing import Any, Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import JSON
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.compiler import compiles


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

# revision identifiers, used by Alembic.
revision: str = "e767d3c57f32"
down_revision: Union[str, None] = "eaf1907ae453"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agent_sessions",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column("session_id", sa.String, nullable=False),
        sa.Column("project_name", sa.String, nullable=False),
        sa.Column(
            "user_id",
            _Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=True,  # sessions may be created while auth is disabled
        ),
        sa.Column("title", sa.String, nullable=False),
        sa.Column(
            "is_temporary",
            sa.Boolean,
            nullable=False,
            server_default=sa.false(),
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
        sa.UniqueConstraint("project_name", "session_id"),
        sqlite_autoincrement=True,
    )
    op.create_index(
        "ix_agent_sessions_user_id_updated_at",
        "agent_sessions",
        ["user_id", sa.column("updated_at").desc()],
    )
    op.create_index(
        "ix_agent_sessions_temporary_updated_at",
        "agent_sessions",
        ["updated_at"],
        unique=False,
        postgresql_where=sa.text("is_temporary IS TRUE"),
        sqlite_where=sa.text("is_temporary IS TRUE"),
    )

    op.create_table(
        "agent_session_messages",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column(
            "agent_session_id",
            _Integer,
            sa.ForeignKey("agent_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer, nullable=False),
        sa.Column("message", JSON_, nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("agent_session_id", "position"),
        sqlite_autoincrement=True,
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
