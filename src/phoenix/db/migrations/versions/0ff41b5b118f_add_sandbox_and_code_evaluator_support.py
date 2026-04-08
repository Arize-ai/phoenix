"""add sandbox and code evaluator support

Revision ID: 0ff41b5b118f
Revises: aba52fffe1a1
Create Date: 2026-02-27 03:14:47.636690

"""

from typing import Any, Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import JSON
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.compiler import compiles


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

_Integer = sa.Integer().with_variant(
    sa.BigInteger(),
    "postgresql",
)

# revision identifiers, used by Alembic.
revision: str = "0ff41b5b118f"
down_revision: Union[str, None] = "aba52fffe1a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    languages_table = op.create_table(
        "languages",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column("name", sa.String, nullable=False, unique=True),
    )
    op.bulk_insert(
        languages_table,
        [
            {"name": "PYTHON"},
            {"name": "TYPESCRIPT"},
        ],
    )

    op.create_table(
        "sandbox_providers",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column(
            "backend_type",
            sa.String,
            nullable=False,
        ),
        sa.Column(
            "language_id",
            _Integer,
            sa.ForeignKey("languages.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("config", JSON_, nullable=False, server_default="{}"),
        sa.Column("enabled", sa.Boolean, nullable=False, server_default=sa.text("true")),
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
        ),
        sa.UniqueConstraint("backend_type", "language_id"),
    )

    op.create_table(
        "sandbox_configs",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column(
            "sandbox_provider_id",
            _Integer,
            sa.ForeignKey("sandbox_providers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("description", sa.String, nullable=True),
        sa.Column("config", JSON_, nullable=False, server_default="{}"),
        sa.Column("timeout", sa.Integer, nullable=False, server_default=sa.text("30")),
        sa.Column("enabled", sa.Boolean, nullable=False, server_default=sa.text("true")),
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
        ),
        sa.UniqueConstraint("sandbox_provider_id", "name"),
    )

    with op.batch_alter_table("code_evaluators") as batch_op:
        batch_op.add_column(
            sa.Column(
                "source_code",
                sa.String,
                server_default="",
                nullable=False,
            ),
        )
        batch_op.add_column(
            sa.Column(
                "language_id",
                _Integer,
                sa.ForeignKey("languages.id", ondelete="RESTRICT"),
                nullable=True,
            ),
        )
        batch_op.add_column(
            sa.Column(
                "input_mapping",
                JSON_,
                server_default='{"literal_mapping": {}, "path_mapping": {}}',
                nullable=False,
            ),
        )
        batch_op.add_column(
            sa.Column(
                "output_configs",
                JSON_,
                server_default="[]",
                nullable=False,
            ),
        )
        batch_op.add_column(
            sa.Column(
                "sandbox_config_id",
                _Integer,
                sa.ForeignKey("sandbox_configs.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
        batch_op.create_index("ix_code_evaluators_language_id", ["language_id"])
        batch_op.create_index("ix_code_evaluators_sandbox_config_id", ["sandbox_config_id"])


def downgrade() -> None:
    # Remove columns/indexes from code_evaluators first (before dropping referenced tables)
    with op.batch_alter_table("code_evaluators") as batch_op:
        batch_op.drop_index("ix_code_evaluators_sandbox_config_id")
        batch_op.drop_index("ix_code_evaluators_language_id")
        batch_op.drop_column("sandbox_config_id")
        batch_op.drop_column("output_configs")
        batch_op.drop_column("input_mapping")
        batch_op.drop_column("language_id")
        batch_op.drop_column("source_code")

    # Drop sandbox_configs (FKs to sandbox_providers and languages)
    op.drop_table("sandbox_configs")

    op.drop_table("sandbox_providers")
    op.drop_table("languages")
