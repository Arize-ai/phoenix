"""users and tokens

Revision ID: cd164e83824f
Revises: 10460e46d750
Create Date: 2024-08-01 18:36:52.157604

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import ScalarSelect, Table, insert

# revision identifiers, used by Alembic.
revision: str = "cd164e83824f"
down_revision: Union[str, None] = "3be8647b87d8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def insert_roles_and_users(
    user_roles_table: Table,
    users_table: Table,
) -> None:
    """
    Populates the `user_roles` table and adds a system user and initial admin
    user to the `users` table.
    """

    def role_id(role_name: str) -> ScalarSelect[int]:
        return (
            sa.select(user_roles_table.c.id)
            .where(user_roles_table.c.name == role_name)
            .scalar_subquery()
        )

    op.execute(
        insert(user_roles_table).values([{"name": "SYSTEM"}, {"name": "ADMIN"}, {"name": "MEMBER"}])
    )
    op.execute(
        insert(users_table).values(
            [
                {
                    "user_role_id": role_id("SYSTEM"),
                    "username": None,
                    "email": "system@localhost",
                    "auth_method": "LOCAL",
                    "password_hash": None,
                    "reset_password": False,
                },
                {
                    "user_role_id": role_id("ADMIN"),
                    "username": "admin",
                    "email": "admin@localhost",
                    "auth_method": "LOCAL",
                    "password_hash": None,
                    "reset_password": True,
                },
            ]
        )
    )


def upgrade() -> None:
    user_roles_table = op.create_table(
        "user_roles",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "name",
            sa.String,
            nullable=False,
            unique=True,
        ),
    )
    users_table = op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "user_role_id",
            sa.Integer,
            sa.ForeignKey("user_roles.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("username", sa.String, nullable=True, unique=True, index=True),
        sa.Column("email", sa.String, nullable=False, unique=True, index=True),
        sa.Column(
            "auth_method",
            sa.String,
            sa.CheckConstraint("auth_method IN ('LOCAL')", "valid_auth_method"),
            nullable=False,
        ),
        sa.Column("password_hash", sa.String, nullable=True),
        sa.Column("reset_password", sa.Boolean, nullable=False),
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
            onupdate=sa.func.now(),
        ),
        sa.Column(
            "deleted_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
    )
    op.create_table(
        "user_sessions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), index=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), index=True),
    )
    op.create_table(
        "api_keys",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), index=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("description", sa.String, nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=True, index=True),
    )
    op.create_table(
        "audit_api_keys",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "api_key_id",
            sa.Integer,
            sa.ForeignKey("api_keys.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "action",
            sa.String,
            sa.CheckConstraint("action IN ('CREATE', 'DELETE')", "valid_action"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    insert_roles_and_users(user_roles_table, users_table)


def downgrade() -> None:
    op.drop_table("audit_api_keys")
    op.drop_table("api_keys")
    op.drop_table("users")
    op.drop_table("user_roles")
