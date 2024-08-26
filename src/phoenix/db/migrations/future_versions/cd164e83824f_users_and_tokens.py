"""users and tokens

Revision ID: cd164e83824f
Revises: 10460e46d750
Create Date: 2024-08-01 18:36:52.157604

"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence, TypedDict, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import (
    JSON,
    TIMESTAMP,
    CheckConstraint,
    Dialect,
    ForeignKey,
    MetaData,
    TypeDecorator,
    func,
    insert,
)
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio.engine import AsyncConnection
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
)

from phoenix.datetime_utils import normalize_datetime


class JSONB(JSON):
    # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    __visit_name__ = "JSONB"


@compiles(JSONB, "sqlite")  # type: ignore
def _(*args: Any, **kwargs: Any) -> str:
    # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    return "JSONB"


JSON_ = (
    JSON()
    .with_variant(
        postgresql.JSONB(),  # type: ignore
        "postgresql",
    )
    .with_variant(
        JSONB(),
        "sqlite",
    )
)


class JsonDict(TypeDecorator[Dict[str, Any]]):
    # See # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    cache_ok = True
    impl = JSON_

    def process_bind_param(self, value: Optional[Dict[str, Any]], _: Dialect) -> Dict[str, Any]:
        return value if isinstance(value, dict) else {}


class JsonList(TypeDecorator[List[Any]]):
    # See # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    cache_ok = True
    impl = JSON_

    def process_bind_param(self, value: Optional[List[Any]], _: Dialect) -> List[Any]:
        return value if isinstance(value, list) else []


class UtcTimeStamp(TypeDecorator[datetime]):
    # See # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    cache_ok = True
    impl = TIMESTAMP(timezone=True)

    def process_bind_param(self, value: Optional[datetime], _: Dialect) -> Optional[datetime]:
        return normalize_datetime(value)

    def process_result_value(self, value: Optional[Any], _: Dialect) -> Optional[datetime]:
        return normalize_datetime(value, timezone.utc)


class ExperimentRunOutput(TypedDict, total=False):
    task_output: Any


class Base(DeclarativeBase):
    # Enforce best practices for naming constraints
    # https://alembic.sqlalchemy.org/en/latest/naming.html#integration-of-naming-conventions-into-operations-autogenerate
    metadata = MetaData(
        naming_convention={
            "ix": "ix_%(table_name)s_%(column_0_N_name)s",
            "uq": "uq_%(table_name)s_%(column_0_N_name)s",
            "ck": "ck_%(table_name)s_`%(constraint_name)s`",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s",
        }
    )
    type_annotation_map = {
        Dict[str, Any]: JsonDict,
        List[Dict[str, Any]]: JsonList,
        ExperimentRunOutput: JsonDict,
    }


class UserRole(Base):
    __tablename__ = "user_roles"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(unique=True)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_role_id: Mapped[int] = mapped_column(
        ForeignKey("user_roles.id"),
        index=True,
    )
    username: Mapped[Optional[str]] = mapped_column(nullable=True, unique=True, index=True)
    email: Mapped[str] = mapped_column(nullable=False, unique=True, index=True)
    auth_method: Mapped[str] = mapped_column(
        CheckConstraint("auth_method IN ('LOCAL')", name="valid_auth_method")
    )
    password_hash: Mapped[Optional[str]]
    reset_password: Mapped[bool]
    created_at: Mapped[datetime] = mapped_column(UtcTimeStamp, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        UtcTimeStamp, server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(UtcTimeStamp)


# revision identifiers, used by Alembic.
revision: str = "cd164e83824f"
down_revision: Union[str, None] = "3be8647b87d8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


async def insert_roles_and_users(connection: AsyncConnection) -> None:
    """
    Populates the `user_roles` table and adds a system user and initial admin
    user to the `users` table.
    """
    await connection.execute(
        insert(UserRole).values([{"name": "SYSTEM"}, {"name": "ADMIN"}, {"name": "MEMBER"}])
    )
    system_user_role_id = sa.select(UserRole.id).where(UserRole.name == "SYSTEM").scalar_subquery()
    admin_user_role_id = sa.select(UserRole.id).where(UserRole.name == "ADMIN").scalar_subquery()
    await connection.execute(
        insert(User).values(
            [
                {
                    "user_role_id": system_user_role_id,
                    "username": None,
                    "email": "system@localhost",
                    "auth_method": "LOCAL",
                    "password_hash": None,
                    "reset_password": False,
                },
                {
                    "user_role_id": admin_user_role_id,
                    "username": "admin",
                    "email": "admin@localhost",
                    "auth_method": "LOCAL",
                    "password_hash": None,  # todo: replace this with the hashed PHOENIX_SECRET
                    "reset_password": True,
                },
            ]
        )
    )


def upgrade() -> None:
    op.create_table(
        "user_roles",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "name",
            sa.String,
            nullable=False,
            unique=True,
        ),
    )
    op.create_table(
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
        "api_keys",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("description", sa.String, nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "expires_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
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
    op.run_async(insert_roles_and_users)


def downgrade() -> None:
    op.drop_table("audit_api_keys")
    op.drop_table("api_keys")
    op.drop_table("users")
    op.drop_table("user_roles")
