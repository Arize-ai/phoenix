"""Add EXTERNAL annotator kind

Revision ID: b7c4f9a1e2d3
Revises: 4aad9107d196
Create Date: 2026-10-17

External (REST/GraphQL) write paths no longer persist client-supplied
``annotator_kind`` values ``LLM`` or ``CODE``: those kinds now mean "graded
by a server-executed evaluator", and the only writer that derives them is
the in-process experiment runner. Client-supplied evaluations are
re-stamped to the new ``EXTERNAL`` kind at the API boundary. This migration
widens the ``valid_annotator_kind`` check constraints so ``EXTERNAL`` rows
can persist.

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7c4f9a1e2d3"
down_revision: Union[str, None] = "4aad9107d196"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Every table with an annotator_kind column.
_TABLES = (
    "span_annotations",
    "trace_annotations",
    "document_annotations",
    "project_session_annotations",
    "experiment_run_annotations",
)

_OLD_CONSTRAINT = "annotator_kind IN ('LLM', 'CODE', 'HUMAN')"
_NEW_CONSTRAINT = "annotator_kind IN ('LLM', 'CODE', 'HUMAN', 'EXTERNAL')"


def upgrade() -> None:
    for table in _TABLES:
        with op.batch_alter_table(table) as batch_op:
            batch_op.drop_constraint(constraint_name="valid_annotator_kind", type_="check")
            batch_op.create_check_constraint(
                constraint_name="valid_annotator_kind",
                condition=_NEW_CONSTRAINT,
            )


def downgrade() -> None:
    # Rows carrying EXTERNAL cannot be represented under the old constraint;
    # fold them back to the closest legacy kind (a client-supplied claim)
    # before narrowing. LLM/CODE/HUMAN rows are untouched.
    for table in _TABLES:
        with op.batch_alter_table(table) as batch_op:
            batch_op.execute(f"UPDATE {table} SET annotator_kind = 'HUMAN' WHERE annotator_kind = 'EXTERNAL'")  # noqa: E501
            batch_op.drop_constraint(constraint_name="valid_annotator_kind", type_="check")
            batch_op.create_check_constraint(
                constraint_name="valid_annotator_kind",
                condition=_OLD_CONSTRAINT,
            )
