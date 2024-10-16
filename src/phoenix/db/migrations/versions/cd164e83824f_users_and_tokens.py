"""users and tokens

Revision ID: cd164e83824f
Revises: 10460e46d750
Create Date: 2024-08-01 18:36:52.157604

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "cd164e83824f"
down_revision: Union[str, None] = "3be8647b87d8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_roles",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "name",
            sa.String,
            nullable=False,
            unique=True,
            index=True,
        ),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "user_role_id",
            sa.Integer,
            sa.ForeignKey("user_roles.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("username", sa.String, nullable=False, unique=True, index=True),
        sa.Column("email", sa.String, nullable=False, unique=True, index=True),
        sa.Column("profile_picture_url", sa.String, nullable=True),
        sa.Column("password_hash", sa.LargeBinary, nullable=True),
        sa.Column("password_salt", sa.LargeBinary, nullable=True),
        sa.Column("reset_password", sa.Boolean, nullable=False),
        sa.Column("oauth2_client_id", sa.String, nullable=True, index=True),
        sa.Column("oauth2_user_id", sa.String, nullable=True, index=True),
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
        sa.CheckConstraint(
            "(password_hash IS NULL) = (password_salt IS NULL)",
            name="password_hash_and_salt",
        ),
        sa.CheckConstraint(
            "(oauth2_client_id IS NULL) = (oauth2_user_id IS NULL)",
            name="oauth2_client_id_and_user_id",
        ),
        sa.CheckConstraint(
            "(password_hash IS NULL) != (oauth2_client_id IS NULL)",
            name="exactly_one_auth_method",
        ),
        sa.UniqueConstraint(
            "oauth2_client_id",
            "oauth2_user_id",
        ),
        sqlite_autoincrement=True,
    )
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            unique=True,
            index=True,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=False, index=True),
        sqlite_autoincrement=True,
    )
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), index=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=False, index=True),
        sqlite_autoincrement=True,
    )
    op.create_table(
        "access_tokens",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), index=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=False, index=True),
        sa.Column(
            "refresh_token_id",
            sa.Integer,
            sa.ForeignKey("refresh_tokens.id", ondelete="CASCADE"),
            index=True,
            unique=True,
        ),
        sqlite_autoincrement=True,
    )
    op.create_table(
        "api_keys",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), index=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("description", sa.String, nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=True, index=True),
        sqlite_autoincrement=True,
    )


def downgrade() -> None:
    op.drop_table("api_keys")
    op.drop_table("access_tokens")
    op.drop_table("refresh_tokens")
    op.drop_table("password_reset_tokens")
    op.drop_table("users")
    op.drop_table("user_roles")
