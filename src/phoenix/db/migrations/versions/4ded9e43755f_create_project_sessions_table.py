"""create project_session table

Revision ID: 4ded9e43755f
Revises: cd164e83824f
Create Date: 2024-10-08 22:53:24.539786

"""

from datetime import datetime
from typing import Any, Optional, Sequence, Union

import sqlalchemy as sa
from alembic import op
from openinference.semconv.trace import SpanAttributes
from sqlalchemy import (
    JSON,
    func,
    insert,
    select,
    update,
)
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class JSONB(JSON):
    # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    __visit_name__ = "JSONB"


@compiles(JSONB, "sqlite")
def _(*args: Any, **kwargs: Any) -> str:
    # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    return "JSONB"


JSON_ = (
    JSON()
    .with_variant(
        postgresql.JSONB(),  # type: ignore
        "postgresql",
    )
    .with_variant(
        JSONB(),
        "sqlite",
    )
)


class Base(DeclarativeBase): ...


class ProjectSession(Base):
    __tablename__ = "project_sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[str]
    session_user: Mapped[Optional[str]]
    project_id: Mapped[int]
    start_time: Mapped[datetime]
    last_trace_start_time: Mapped[datetime]


class Trace(Base):
    __tablename__ = "traces"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_session_rowid: Mapped[Union[int, None]]
    project_rowid: Mapped[int]
    start_time: Mapped[datetime]


class Span(Base):
    __tablename__ = "spans"
    id: Mapped[int] = mapped_column(primary_key=True)
    trace_rowid: Mapped[int]
    parent_id: Mapped[Optional[str]]
    attributes: Mapped[dict[str, Any]] = mapped_column(JSON_, nullable=False)


# revision identifiers, used by Alembic.
revision: str = "4ded9e43755f"
down_revision: Union[str, None] = "cd164e83824f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


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
            index=True,
        ),
        sa.Column("start_time", sa.TIMESTAMP(timezone=True), index=True, nullable=False),
        sa.Column("last_trace_start_time", sa.TIMESTAMP(timezone=True), index=True, nullable=False),
    )
    with op.batch_alter_table("traces") as batch_op:
        batch_op.add_column(
            sa.Column(
                "project_session_rowid",
                sa.Integer,
                sa.ForeignKey("project_sessions.id", ondelete="CASCADE"),
                nullable=True,
            ),
        )
    op.create_index(
        "ix_traces_project_session_rowid",
        "traces",
        ["project_session_rowid"],
    )
    sessions_from_span = (
        select(
            Span.attributes[SESSION_ID].as_string().label("session_id"),
            Span.attributes[USER_ID].as_string().label("session_user"),
            Trace.project_rowid.label("project_id"),
            Trace.start_time.label("start_time"),
            func.row_number()
            .over(
                partition_by=Span.attributes[SESSION_ID],
                order_by=[Trace.start_time, Trace.id, Span.id],
            )
            .label("rank"),
            func.max(Trace.start_time)
            .over(partition_by=Span.attributes[SESSION_ID])
            .label("last_trace_start_time"),
        )
        .join_from(Span, Trace, Span.trace_rowid == Trace.id)
        .where(Span.parent_id.is_(None))
        .where(Span.attributes[SESSION_ID].as_string() != "")
        .subquery()
    )
    op.execute(
        insert(ProjectSession).from_select(
            [
                "session_id",
                "session_user",
                "project_id",
                "start_time",
                "last_trace_start_time",
            ],
            select(
                sessions_from_span.c.session_id,
                sessions_from_span.c.session_user,
                sessions_from_span.c.project_id,
                sessions_from_span.c.start_time,
                sessions_from_span.c.last_trace_start_time,
            ).where(sessions_from_span.c.rank == 1),
        )
    )
    sessions_for_trace_id = (
        select(
            Span.trace_rowid,
            ProjectSession.id.label("project_session_rowid"),
        )
        .join_from(
            Span,
            ProjectSession,
            Span.attributes[SESSION_ID].as_string() == ProjectSession.session_id,
        )
        .where(Span.parent_id.is_(None))
        .where(Span.attributes[SESSION_ID].as_string() != "")
        .subquery()
    )
    op.execute(
        (
            update(Trace)
            .values(project_session_rowid=sessions_for_trace_id.c.project_session_rowid)
            .where(Trace.id == sessions_for_trace_id.c.trace_rowid)
        )
    )


def downgrade() -> None:
    op.drop_index("ix_traces_project_session_rowid")
    with op.batch_alter_table("traces") as batch_op:
        batch_op.drop_column("project_session_rowid")
    op.drop_table("project_sessions")


SESSION_ID = SpanAttributes.SESSION_ID.split(".")
USER_ID = SpanAttributes.USER_ID.split(".")
