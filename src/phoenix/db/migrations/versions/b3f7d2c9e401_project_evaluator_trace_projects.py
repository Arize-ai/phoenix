"""give each project evaluator its own trace project

Revision ID: b3f7d2c9e401
Revises: a7f1c3e9d2b4
Create Date: 2026-08-21 00:00:00.000000

Project evaluators used to trace into one shared project named ``evaluators``,
so unrelated evaluators on unrelated projects were interleaved in a single
bucket and every per-project stat an evaluator's Traces tab reported belonged
to the bucket rather than the evaluator. Each criteria row now carries the
project its own executions trace into, mirroring dataset evaluators.

The traces already in the shared project are left where they are. Nothing
portable across dialects attributes them to one evaluator -- only a span
attribute does, which SQLite and PostgreSQL read differently -- and a project
that already holds history reads better intact than split by a best-effort
query. New traces route per evaluator; the shared project becomes an ordinary
project holding the history it already had.
"""

from secrets import token_hex
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b3f7d2c9e401"
down_revision: Union[str, None] = "a7f1c3e9d2b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_Integer = sa.Integer().with_variant(
    sa.BigInteger(),
    "postgresql",
)

_INDEX_NAME = "ix_project_evaluator_criteria_trace_project_id"

# Lightweight table stubs: the ORM models move on, a migration must not.
_projects = sa.table(
    "projects",
    sa.column("id"),
    sa.column("name"),
    sa.column("description"),
)
_criteria = sa.table(
    "project_evaluator_criteria",
    sa.column("id"),
    sa.column("name"),
    sa.column("project_id"),
    sa.column("trace_project_id"),
)


def upgrade() -> None:
    with op.batch_alter_table("project_evaluator_criteria") as batch_op:
        batch_op.add_column(
            sa.Column(
                "trace_project_id",
                _Integer,
                sa.ForeignKey("projects.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
    op.create_index(
        _INDEX_NAME,
        "project_evaluator_criteria",
        ["trace_project_id"],
    )
    _backfill_trace_projects()


def downgrade() -> None:
    # The trace projects themselves are left in place. Removing one means
    # removing the traces it holds, and a migration runs with SQLite foreign key
    # enforcement off (see `_FOREIGN_KEY_PRAGMAS` in db/engines.py), so the
    # cascade that would clear those traces does not fire and the rows would be
    # orphaned rather than deleted. A downgraded deployment sees them as
    # ordinary projects, each described by the evaluator whose traces it holds.
    op.drop_index(_INDEX_NAME, table_name="project_evaluator_criteria")
    with op.batch_alter_table("project_evaluator_criteria") as batch_op:
        batch_op.drop_column("trace_project_id")


def _backfill_trace_projects() -> None:
    """Create one trace project per existing project evaluator.

    The name is generated rather than derived from the evaluator so it cannot
    collide with a project a user already has, and so a user is unlikely to
    reach for it by hand -- the same reason dataset evaluators generate theirs.
    """
    connection = op.get_bind()
    rows = connection.execute(
        sa.select(_criteria.c.id, _criteria.c.name, _projects.c.name)
        .join_from(_criteria, _projects, _criteria.c.project_id == _projects.c.id)
        .order_by(_criteria.c.id)
    ).all()
    for criteria_id, criteria_name, project_name in rows:
        trace_project_id = connection.execute(
            sa.insert(_projects)
            .values(
                name=f"project-evaluator-{token_hex(12)}",
                description=(
                    f"Traces for project evaluator: {criteria_name} on project: {project_name}"
                ),
            )
            .returning(_projects.c.id)
        ).scalar_one()
        connection.execute(
            sa.update(_criteria)
            .where(_criteria.c.id == criteria_id)
            .values(trace_project_id=trace_project_id)
        )
