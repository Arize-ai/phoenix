"""add decision_sdk to custom providers

A custom provider serves decision models only when it names a decision client: ``openai``
(OpenAI's Decisions API) or ``typesafe`` (System One). TypeSafe-SDK providers exist only
to serve decisions, so they get ``typesafe``; every other provider starts with none,
including OpenAI-SDK ones, which used to offer decisions implicitly.

Revision ID: 00eb0d0a5db9
Revises: e724eb2ee5cf
Create Date: 2026-10-30 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "00eb0d0a5db9"
down_revision: Union[str, None] = "e724eb2ee5cf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("generative_model_custom_providers") as batch_op:
        batch_op.add_column(sa.Column("decision_sdk", sa.String, nullable=True))
    op.execute(
        "UPDATE generative_model_custom_providers SET decision_sdk = 'typesafe' "
        "WHERE sdk = 'typesafe'"
    )


def downgrade() -> None:
    with op.batch_alter_table("generative_model_custom_providers") as batch_op:
        batch_op.drop_column("decision_sdk")
