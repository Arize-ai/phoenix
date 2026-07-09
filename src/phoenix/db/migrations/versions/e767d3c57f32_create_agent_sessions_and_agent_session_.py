"""create agent_sessions and agent_session_snapshots tables

Revision ID: e767d3c57f32
Revises: c9d0e1f2a3b4
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
down_revision: Union[str, None] = "c9d0e1f2a3b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agent_sessions",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column("session_id", sa.String, unique=True, nullable=False),
        sa.Column(
            "user_id",
            _Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=True,  # sessions may be created while auth is disabled
        ),
        sa.Column("title", sa.String, nullable=False),
        sa.Column("messages", JSON_, nullable=False),
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
    op.drop_table("agent_sessions")
