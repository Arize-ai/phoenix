"""add json_path to template_format

Revision ID: 861cde0a7eb5
Revises: 02463bd83119
Create Date: 2026-01-14 15:14:03.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = "861cde0a7eb5"
down_revision: Union[str, None] = "02463bd83119"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _sqlite_recreate_table_with_new_constraint(
    conn: sa.Connection,
    new_constraint_values: str,
) -> None:
    """
    Recreate the prompt_versions table with an updated template_format constraint.

    SQLite doesn't support ALTER TABLE for CHECK constraints, so we need to:
    1. Create a new table with the updated constraint
    2. Copy data from the old table
    3. Drop the old table
    4. Rename the new table
    """
    # Create new table with updated constraint
    conn.execute(
        text(
            f"""
            CREATE TABLE _alembic_tmp_prompt_versions (
                id INTEGER NOT NULL PRIMARY KEY,
                prompt_id INTEGER NOT NULL,
                description VARCHAR,
                user_id INTEGER,
                template_type VARCHAR NOT NULL,
                template_format VARCHAR NOT NULL,
                template NUMERIC NOT NULL,
                invocation_parameters NUMERIC NOT NULL,
                tools JSON,
                response_format JSON,
                model_provider VARCHAR NOT NULL,
                model_name VARCHAR NOT NULL,
                metadata NUMERIC NOT NULL,
                created_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
                CONSTRAINT fk_prompt_versions_prompt_id_prompts
                    FOREIGN KEY(prompt_id) REFERENCES prompts (id) ON DELETE CASCADE,
                CONSTRAINT fk_prompt_versions_user_id_users
                    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL,
                CONSTRAINT template_type CHECK (template_type IN ('CHAT', 'STR')),
                CONSTRAINT template_format CHECK (template_format IN ({new_constraint_values}))
            )
            """
        )
    )

    # Copy data
    conn.execute(
        text(
            """
            INSERT INTO _alembic_tmp_prompt_versions
            SELECT * FROM prompt_versions
            """
        )
    )

    # Drop old table
    conn.execute(text("DROP TABLE prompt_versions"))

    # Rename new table
    conn.execute(text("ALTER TABLE _alembic_tmp_prompt_versions RENAME TO prompt_versions"))

    # Recreate indices
    conn.execute(text("CREATE INDEX ix_prompt_versions_prompt_id ON prompt_versions (prompt_id)"))
    conn.execute(text("CREATE INDEX ix_prompt_versions_user_id ON prompt_versions (user_id)"))


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == "sqlite":
        _sqlite_recreate_table_with_new_constraint(
            bind,
            "'F_STRING', 'MUSTACHE', 'NONE', 'JSON_PATH'",
        )
    else:
        # PostgreSQL: drop and recreate the constraint
        op.drop_constraint(
            "ck_prompt_versions_`template_format`",
            "prompt_versions",
            type_="check",
        )
        op.create_check_constraint(
            "ck_prompt_versions_`template_format`",
            "prompt_versions",
            sa.text("template_format IN ('F_STRING', 'MUSTACHE', 'NONE', 'JSON_PATH')"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == "sqlite":
        _sqlite_recreate_table_with_new_constraint(
            bind,
            "'F_STRING', 'MUSTACHE', 'NONE'",
        )
    else:
        op.drop_constraint(
            "ck_prompt_versions_`template_format`",
            "prompt_versions",
            type_="check",
        )
        op.create_check_constraint(
            "ck_prompt_versions_`template_format`",
            "prompt_versions",
            sa.text("template_format IN ('F_STRING', 'MUSTACHE', 'NONE')"),
        )
