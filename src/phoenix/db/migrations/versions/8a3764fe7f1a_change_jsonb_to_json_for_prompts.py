"""change jsonb to json for prompts

Revision ID: 8a3764fe7f1a
Revises: bb8139330879
Create Date: 2025-04-25 07:04:26.102957

"""

from typing import Any, Sequence, Union

from alembic import op
from sqlalchemy import JSON
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.compiler import compiles

# revision identifiers, used by Alembic.
revision: str = "8a3764fe7f1a"
down_revision: Union[str, None] = "bb8139330879"
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
        batch_op.alter_column(
            "tools",
            type_=JSON,
            existing_type=JSON_,
            postgresql_using="tools::json",
        )
        batch_op.alter_column(
            "response_format",
            type_=JSON,
            existing_type=JSON_,
            postgresql_using="response_format::json",
        )


def downgrade() -> None:
    with op.batch_alter_table("prompt_versions") as batch_op:
        batch_op.alter_column(
            "tools",
            type_=JSON_,
            existing_type=JSON,
            postgresql_using="tools::jsonb",
        )
        batch_op.alter_column(
            "response_format",
            type_=JSON_,
            existing_type=JSON,
            postgresql_using="response_format::jsonb",
        )
