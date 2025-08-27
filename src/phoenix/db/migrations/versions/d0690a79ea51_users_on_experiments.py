"""users_on_experiments

Revision ID: d0690a79ea51
Revises: 0df286449799
Create Date: 2025-08-26 19:12:47.849806

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d0690a79ea51"
down_revision: Union[str, None] = "0df286449799"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("experiments", sa.Column("user_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_experiments_user_id_users", "experiments", "users", ["user_id"], ["id"], ondelete="SET NULL")


def downgrade() -> None:
    op.drop_constraint("fk_experiments_user_id_users", "experiments", type_="foreignkey")
    op.drop_column("experiments", "user_id")
