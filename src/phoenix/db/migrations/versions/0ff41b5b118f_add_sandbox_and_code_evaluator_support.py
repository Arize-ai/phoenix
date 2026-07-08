"""add sandbox and code evaluator support

Revision ID: 0ff41b5b118f
Revises: 575aa27302ee
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
down_revision: Union[str, None] = "575aa27302ee"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "languages",
        sa.Column("name", sa.String, primary_key=True),
    )
    op.execute(sa.text("INSERT INTO languages (name) VALUES ('PYTHON'), ('TYPESCRIPT')"))

    op.create_table(
        "sandbox_providers",
        sa.Column("backend_type", sa.String, primary_key=True),
        sa.Column("enabled", sa.Boolean, nullable=False),
        sa.Column("config", JSON_, nullable=False, server_default="{}"),
        sa.Column(
            "user_id",
            _Integer,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_table(
        "sandbox_configs",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column(
            "backend_type",
            sa.String,
            sa.ForeignKey("sandbox_providers.backend_type", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "language",
            sa.String,
            sa.ForeignKey("languages.name", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("description", sa.String, nullable=True),
        sa.Column("config", JSON_, nullable=False, server_default="{}"),
        sa.Column("timeout", sa.Integer, nullable=False),
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
        sa.Column(
            "user_id",
            _Integer,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.UniqueConstraint("backend_type", "name"),
        sa.UniqueConstraint("language", "id"),  # needed for the composite FK
    )

    # Composite FK named explicitly to avoid collision with the simple FK on
    # sandbox_config_id (both would auto-name to the same identifier).
    with op.batch_alter_table("code_evaluators") as batch_op:
        batch_op.add_column(
            sa.Column(
                "language",
                sa.String,
                sa.ForeignKey("languages.name", ondelete="RESTRICT"),
                nullable=False,
                server_default="PYTHON",  # removed below
            )
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
            sa.Column("output_configs", JSON_, server_default="[]", nullable=False),
        )
        batch_op.add_column(
            sa.Column(
                "sandbox_config_id",
                _Integer,
                sa.ForeignKey("sandbox_configs.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
        batch_op.alter_column("language", server_default=None)
        batch_op.create_index("ix_code_evaluators_language", ["language"])
        batch_op.create_index("ix_code_evaluators_sandbox_config_id", ["sandbox_config_id"])
        batch_op.create_foreign_key(
            "fk_code_evaluators_sandbox_config_language",
            "sandbox_configs",
            ["sandbox_config_id", "language"],
            ["id", "language"],
        )

    op.create_table(
        "code_evaluator_code_versions",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column(
            "code_evaluator_id",
            _Integer,
            sa.ForeignKey("code_evaluators.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            _Integer,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("source_code", sa.String, nullable=False, server_default=""),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sqlite_autoincrement=True,
    )
    op.create_index(
        "ix_code_evaluator_code_versions_code_evaluator_id_id",
        "code_evaluator_code_versions",
        ["code_evaluator_id", "id"],
    )


def downgrade() -> None:
    # Drop code_evaluator_code_versions first (FKs into code_evaluators).
    op.drop_table("code_evaluator_code_versions")

    with op.batch_alter_table("code_evaluators") as batch_op:
        batch_op.drop_constraint("fk_code_evaluators_sandbox_config_language", type_="foreignkey")
        batch_op.drop_index("ix_code_evaluators_sandbox_config_id")
        batch_op.drop_index("ix_code_evaluators_language")
        batch_op.drop_column("sandbox_config_id")
        batch_op.drop_column("output_configs")
        batch_op.drop_column("input_mapping")
        batch_op.drop_column("language")

    op.drop_table("sandbox_configs")
    op.drop_table("sandbox_providers")
    op.drop_table("languages")
