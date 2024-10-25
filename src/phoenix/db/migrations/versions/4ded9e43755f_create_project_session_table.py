"""create table for chat sessions

Revision ID: 4ded9e43755f
Revises: cd164e83824f
Create Date: 2024-10-08 22:53:24.539786

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = "4ded9e43755f"
down_revision: Union[str, None] = "cd164e83824f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def create_sqlite_trigger() -> str:
    return """
    CREATE TRIGGER IF NOT EXISTS delete_session_if_no_spans
    AFTER DELETE ON chat_session_spans
    FOR EACH ROW
    BEGIN
        DELETE FROM project_sessions
        WHERE id = OLD.session_rowid
          AND NOT EXISTS (
              SELECT 1 FROM chat_session_spans WHERE session_rowid = OLD.session_rowid
          );
    END;
    """


def create_postgresql_trigger() -> str:
    return """
    CREATE OR REPLACE FUNCTION delete_session_if_no_spans()
    RETURNS TRIGGER AS $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM chat_session_spans WHERE session_rowid = OLD.session_rowid
        ) THEN
            DELETE FROM project_sessions WHERE id = OLD.session_rowid;
        END IF;
        RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER delete_session_if_no_spans
    AFTER DELETE ON chat_session_spans
    FOR EACH ROW
    EXECUTE FUNCTION delete_session_if_no_spans();
    """


def upgrade() -> None:
    op.create_table(
        "project_sessions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("session_id", sa.String, unique=True, nullable=False),
        sa.Column("session_user", sa.String, index=True),
        sa.Column(
            "project_id",
            sa.Integer,
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("start_time", sa.TIMESTAMP(timezone=True), index=True, nullable=False),
        sa.Column("end_time", sa.TIMESTAMP(timezone=True), index=True, nullable=False),
    )
    op.create_table(
        "chat_session_spans",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "session_rowid",
            sa.Integer,
            sa.ForeignKey("project_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(  # stopgap column pending trigger implementation
            "session_id",
            sa.String,
            nullable=False,
            index=True,
        ),
        sa.Column(  # stopgap column pending trigger implementation
            "session_user",
            sa.String,
            index=True,
        ),
        sa.Column(
            "timestamp",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "span_rowid",
            sa.Integer,
            sa.ForeignKey("spans.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "trace_rowid",
            sa.Integer,
            sa.ForeignKey("traces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "project_id",
            sa.Integer,
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
    )
    op.execute(
        """
        CREATE INDEX ix_chat_session_spans_start_time_session_id
        ON chat_session_spans (timestamp DESC, session_rowid);
        """
    )
    op.execute(
        """
        CREATE INDEX ix_chat_session_spans_session_id_start_time
        ON chat_session_spans (session_rowid, timestamp DESC);
        """
    )
    conn = op.get_bind()
    dialect = conn.engine.dialect.name
    if dialect == "sqlite":
        conn.execute(text("PRAGMA foreign_keys = ON"))
        conn.execute(text(create_sqlite_trigger()))
    elif dialect == "postgresql":
        conn.execute(text(create_postgresql_trigger()))


def downgrade() -> None:
    conn = op.get_bind()
    dialect = conn.engine.dialect.name
    if dialect == "sqlite":
        conn.execute(text("DROP TRIGGER IF EXISTS delete_session_if_no_spans"))
    elif dialect == "postgresql":
        conn.execute(text("DROP TRIGGER IF EXISTS delete_session_if_no_spans ON spans"))
        conn.execute(text("DROP FUNCTION IF EXISTS delete_session_if_no_spans"))
    op.drop_table("chat_session_spans")
    op.drop_table("project_sessions")
