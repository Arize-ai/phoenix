"""add sandbox_config_instances table and migrate code_evaluators FK

Revision ID: 68144d092e82
Revises: 0ff41b5b118f
Create Date: 2026-03-09 00:00:00.000000

"""

from typing import Any, Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import JSON
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.compiler import compiles

# revision identifiers, used by Alembic.
revision: str = "68144d092e82"
down_revision: Union[str, None] = "0ff41b5b118f"
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
    # 1. Create the sandbox_config_instances table
    op.create_table(
        "sandbox_config_instances",
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
        sa.CheckConstraint(
            "backend_type IN ('WASM', 'E2B', 'VERCEL', 'DAYTONA')",
            name="valid_sandbox_instance_backend_type",
        ),
    )

    # 2. Backfill: copy each sandbox_configs row into sandbox_config_instances with name='default'
    op.execute(
        sa.text(
            "INSERT INTO sandbox_config_instances "
            "(backend_type, name, config, timeout, enabled, config_hash, created_at, updated_at) "
            "SELECT backend_type, 'default', config, timeout, enabled, config_hash, "
            "created_at, updated_at "
            "FROM sandbox_configs"
        )
    )

    # 3. Save the old->new ID mapping before batch_alter_table recreates the table
    op.execute(
        sa.text(
            "CREATE TEMPORARY TABLE _sandbox_id_map AS "
            "SELECT sc.id AS old_id, sci.id AS new_id "
            "FROM sandbox_configs sc "
            "JOIN sandbox_config_instances sci "
            "  ON sc.backend_type = sci.backend_type "
            "  AND sci.name = 'default'"
        )
    )

    # 4. Update code_evaluators.sandbox_config_id to new instance IDs (while FK still points
    #    to sandbox_configs — the values will be carried through batch_alter_table's table copy)
    op.execute(
        sa.text(
            "UPDATE code_evaluators SET sandbox_config_id = ("
            "  SELECT new_id FROM _sandbox_id_map WHERE old_id = code_evaluators.sandbox_config_id"
            ") WHERE sandbox_config_id IS NOT NULL"
        )
    )

    # 5. Migrate FK: recreate code_evaluators with FK pointing to sandbox_config_instances.
    #    batch_alter_table preserves column data during the table recreation.
    with op.batch_alter_table(
        "code_evaluators",
        naming_convention={
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
        },
    ) as batch_op:
        batch_op.drop_constraint(
            "fk_code_evaluators_sandbox_config_id_sandbox_configs", type_="foreignkey"
        )
        batch_op.create_foreign_key(
            "fk_code_evaluators_sandbox_config_id_sandbox_config_instances",
            "sandbox_config_instances",
            ["sandbox_config_id"],
            ["id"],
            ondelete="SET NULL",
        )

    # 6. Clean up temp table
    op.execute(sa.text("DROP TABLE IF EXISTS _sandbox_id_map"))


def downgrade() -> None:
    # 1. Build reverse mapping
    op.execute(
        sa.text(
            "CREATE TEMPORARY TABLE _sandbox_id_map AS "
            "SELECT sci.id AS instance_id, sc.id AS config_id "
            "FROM sandbox_config_instances sci "
            "JOIN sandbox_configs sc ON sc.backend_type = sci.backend_type "
            "WHERE sci.name = 'default'"
        )
    )

    # 2. Map FK values back to sandbox_configs IDs
    op.execute(
        sa.text(
            "UPDATE code_evaluators SET sandbox_config_id = ("
            "  SELECT config_id FROM _sandbox_id_map "
            "  WHERE instance_id = code_evaluators.sandbox_config_id"
            ") WHERE sandbox_config_id IS NOT NULL"
        )
    )

    # 3. Restore FK to sandbox_configs
    with op.batch_alter_table(
        "code_evaluators",
        naming_convention={
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
        },
    ) as batch_op:
        batch_op.drop_constraint(
            "fk_code_evaluators_sandbox_config_id_sandbox_config_instances", type_="foreignkey"
        )
        batch_op.create_foreign_key(
            "fk_code_evaluators_sandbox_config_id_sandbox_configs",
            "sandbox_configs",
            ["sandbox_config_id"],
            ["id"],
            ondelete="SET NULL",
        )

    # 4. Clean up
    op.execute(sa.text("DROP TABLE IF EXISTS _sandbox_id_map"))

    # 5. Drop the sandbox_config_instances table
    op.drop_table("sandbox_config_instances")
