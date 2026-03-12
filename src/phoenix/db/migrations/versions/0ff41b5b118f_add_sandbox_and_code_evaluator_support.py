"""add sandbox and code evaluator support

Revision ID: 0ff41b5b118f
Revises: f1a6b2f0c9d5
Create Date: 2026-02-27 03:14:47.636690

"""

from typing import Any, Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import JSON
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.compiler import compiles

# revision identifiers, used by Alembic.
revision: str = "0ff41b5b118f"
down_revision: Union[str, None] = "f1a6b2f0c9d5"
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
    op.create_table(
        "sandbox_adapters",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "backend_type",
            sa.String,
            nullable=False,
        ),
        sa.Column("config", JSON_, nullable=False, server_default="{}"),
        sa.Column("timeout", sa.Integer, nullable=False, server_default=sa.text("30")),
        sa.Column("enabled", sa.Boolean, nullable=False, server_default=sa.text("1")),
        sa.Column("config_hash", sa.String(16), nullable=False, server_default=""),
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
        sa.UniqueConstraint("backend_type"),
    )

    op.create_table(
        "sandbox_configs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "backend_type",
            sa.String,
            nullable=False,
        ),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("description", sa.String, nullable=True),
        sa.Column("config", JSON_, nullable=False, server_default="{}"),
        sa.Column("timeout", sa.Integer, nullable=False, server_default=sa.text("30")),
        sa.Column("enabled", sa.Boolean, nullable=False, server_default=sa.text("1")),
        sa.Column("config_hash", sa.String(16), nullable=False, server_default=""),
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
        sa.UniqueConstraint("backend_type", "name"),
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
                "language",
                sa.String,
                server_default="PYTHON",
                nullable=False,
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
                "input_schema",
                JSON_,
                server_default="{}",
                nullable=False,
            ),
        )
        batch_op.add_column(
            sa.Column(
                "sandbox_config_id",
                sa.Integer,
                sa.ForeignKey("sandbox_configs.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
        batch_op.add_column(
            sa.Column(
                "sandbox_config_hash",
                sa.String(16),
                nullable=True,
            ),
        )
        batch_op.create_check_constraint(
            constraint_name="valid_code_evaluator_language",
            condition="language IN ('PYTHON', 'TYPESCRIPT')",
        )
        batch_op.create_index("ix_code_evaluators_sandbox_config_id", ["sandbox_config_id"])

    op.create_table(
        "sandbox_settings",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("enabled", sa.Boolean, nullable=False, server_default=sa.text("1")),
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
        sa.CheckConstraint("id = 1", name="sandbox_settings_singleton"),
    )


def downgrade() -> None:
    op.drop_table("sandbox_settings")

    with op.batch_alter_table("code_evaluators") as batch_op:
        batch_op.drop_index("ix_code_evaluators_sandbox_config_id")
        batch_op.drop_constraint("valid_code_evaluator_language", type_="check")
        batch_op.drop_column("sandbox_config_hash")
        batch_op.drop_column("sandbox_config_id")
        batch_op.drop_column("input_schema")
        batch_op.drop_column("output_configs")
        batch_op.drop_column("input_mapping")
        batch_op.drop_column("language")
        batch_op.drop_column("source_code")

    op.drop_table("sandbox_configs")
    op.drop_table("sandbox_adapters")
