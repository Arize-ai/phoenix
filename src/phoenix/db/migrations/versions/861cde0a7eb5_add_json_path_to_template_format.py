"""add json_path to template_format

Revision ID: 861cde0a7eb5
Revises: 02463bd83119
Create Date: 2026-01-14 15:14:03.000000

"""

from typing import Any, Sequence, Union

from alembic import op
from sqlalchemy import JSON
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.compiler import compiles

# revision identifiers, used by Alembic.
revision: str = "861cde0a7eb5"
down_revision: Union[str, None] = "02463bd83119"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


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
        postgresql.JSONB(),
        "postgresql",
    )
    .with_variant(
        JSONB(),
        "sqlite",
    )
)


def upgrade() -> None:
    with op.batch_alter_table("prompt_versions") as batch_op:
        batch_op.drop_constraint(
            constraint_name="template_format",
            type_="check",
        )
        batch_op.create_check_constraint(
            constraint_name="template_format",
            condition="template_format IN ('F_STRING', 'MUSTACHE', 'NONE', 'JSON_PATH')",
        )


def downgrade() -> None:
    with op.batch_alter_table("prompt_versions") as batch_op:
        batch_op.drop_constraint(
            constraint_name="template_format",
            type_="check",
        )
        batch_op.create_check_constraint(
            constraint_name="template_format",
            condition="template_format IN ('F_STRING', 'MUSTACHE', 'NONE')",
        )
