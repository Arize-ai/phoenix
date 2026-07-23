"""set_serial_sequence_minvalue_and_cycle

Revision ID: e77bee06f3ac
Revises: d4e5f6a7b8c9
Create Date: 2026-07-05 20:59:18.906153

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e77bee06f3ac"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_SERIAL_TABLES = (
    "projects",
    "spans",
    "traces",
)


def upgrade() -> None:
    # Set MINVALUE to the smallest 32-bit integer and enable CYCLE so sequences
    # wrap around instead of erroring when they reach MAXVALUE. This is idempotent
    # — safe to run on both new and existing deployments.
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        for table in _SERIAL_TABLES:
            op.execute(sa.text(f"ALTER SEQUENCE {table}_id_seq MINVALUE -2147483648 CYCLE"))


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        for table in _SERIAL_TABLES:
            # Restart at the first unused positive id. This avoids an immediate
            # primary-key collision when positive ids already exist, while also
            # moving the sequence out of any negative wrapped position before
            # restoring the original MINVALUE.
            op.execute(
                sa.text(
                    f"""
                    DO $$
                    DECLARE
                        restart_value integer;
                    BEGIN
                        SELECT min(candidate)
                        INTO restart_value
                        FROM (
                            SELECT 1 AS candidate
                            WHERE NOT EXISTS (SELECT 1 FROM {table} WHERE id = 1)
                            UNION ALL
                            SELECT id + 1 AS candidate
                            FROM {table} existing
                            WHERE id > 0
                              AND id < 2147483647
                              AND NOT EXISTS (
                                  SELECT 1
                                  FROM {table} next_row
                                  WHERE next_row.id = existing.id + 1
                              )
                        ) candidates;

                        ALTER SEQUENCE {table}_id_seq
                            RESTART WITH 1
                            MINVALUE 1
                            NO CYCLE;

                        IF restart_value IS NULL THEN
                            PERFORM setval('{table}_id_seq', 2147483647, true);
                        ELSE
                            PERFORM setval('{table}_id_seq', restart_value, false);
                        END IF;
                    END $$;
                    """
                )
            )
