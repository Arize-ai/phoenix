"""add project evaluator tracing enabled

Revision ID: b3d9f2a61c47
Revises: e724eb2ee5cf
Create Date: 2026-11-06 00:00:00.000000

project_evaluators gains tracing_enabled: whether the evaluator's runs write traces to
its trace project. Existing evaluators keep writing traces, so the column defaults to
true and needs no backfill.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b3d9f2a61c47"
down_revision: Union[str, None] = "e724eb2ee5cf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "project_evaluators",
        sa.Column(
            "tracing_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )


def downgrade() -> None:
    op.drop_column("project_evaluators", "tracing_enabled")
