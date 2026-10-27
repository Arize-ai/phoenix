"""add DECISION annotator kind

Revision ID: 7c2bc8452d60
Revises: f3b8c2d14e70
Create Date: 2026-10-27 12:00:00.000000

The downgrade rewrites DECISION annotations to LLM, which is what decision
evaluators wrote before this kind existed, so the rows survive the narrower
check.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7c2bc8452d60"
down_revision: Union[str, None] = "f3b8c2d14e70"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLES = (
    "span_annotations",
    "trace_annotations",
    "document_annotations",
    "project_session_annotations",
    "experiment_run_annotations",
)


def _set_valid_annotator_kinds(condition: str) -> None:
    for table in _TABLES:
        with op.batch_alter_table(table) as batch_op:
            batch_op.drop_constraint("valid_annotator_kind", type_="check")
            batch_op.create_check_constraint("valid_annotator_kind", condition)


def upgrade() -> None:
    _set_valid_annotator_kinds("annotator_kind IN ('LLM', 'CODE', 'HUMAN', 'DECISION')")


def downgrade() -> None:
    for table in _TABLES:
        op.execute(
            sa.text(f"UPDATE {table} SET annotator_kind = 'LLM' WHERE annotator_kind = 'DECISION'")
        )
    _set_valid_annotator_kinds("annotator_kind IN ('LLM', 'CODE', 'HUMAN')")
