"""add oauth2 authorization server tables

Revision ID: 132d988c5bef
Revises: eaf1907ae453
Create Date: 2026-07-09 00:41:15.427576

"""

from typing import Any, Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import JSON
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.compiler import compiles


class JSONB(JSON):
    __visit_name__ = "JSONB"


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(*args: Any, **kwargs: Any) -> str:
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
revision: str = "132d988c5bef"
down_revision: Union[str, None] = "eaf1907ae453"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "oauth2_clients",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column("client_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("logo_uri", sa.String(), nullable=True),
        sa.Column("redirect_uris", JSON_, nullable=False),
        sa.Column("grant_types", JSON_, nullable=False),
        sa.Column("token_endpoint_auth_method", sa.String(), nullable=False),
        sa.Column(
            "is_first_party",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("metadata", JSON_, nullable=True),
        sa.Column("registration_client_ip", sa.String(), nullable=True),
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
        sqlite_autoincrement=True,
    )
    op.create_index("ix_oauth2_clients_client_id", "oauth2_clients", ["client_id"], unique=True)
    op.create_index(
        "ix_oauth2_clients_registration_client_ip",
        "oauth2_clients",
        ["registration_client_ip", "created_at"],
    )

    op.create_table(
        "oauth2_grants",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column(
            "user_id",
            _Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "oauth2_client_id",
            _Integer,
            sa.ForeignKey("oauth2_clients.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("scopes", JSON_, nullable=True),
        sa.Column("audience", JSON_, nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("last_used_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sqlite_autoincrement=True,
    )

    op.create_table(
        "oauth2_authorization_codes",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column("code_hash", sa.String(), nullable=False),
        sa.Column(
            "user_id",
            _Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "oauth2_client_id",
            _Integer,
            sa.ForeignKey("oauth2_clients.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("redirect_uri", sa.String(), nullable=False),
        sa.Column("code_challenge", sa.String(), nullable=False),
        sa.Column("code_challenge_method", sa.String(), nullable=False),
        sa.Column("scopes", JSON_, nullable=True),
        sa.Column("resource", sa.String(), nullable=True),
        sa.Column("audience", JSON_, nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sqlite_autoincrement=True,
    )
    op.create_index(
        "ix_oauth2_authorization_codes_code_hash",
        "oauth2_authorization_codes",
        ["code_hash"],
        unique=True,
    )
    op.create_index(
        "ix_oauth2_authorization_codes_expires_at",
        "oauth2_authorization_codes",
        ["expires_at"],
    )

    # The ORM has always declared these columns as non-nullable, so no code path can write
    # a NULL, but the tables were created without the constraint. The token tables are
    # already being rebuilt here; tightening them now costs nothing, whereas doing it later
    # would need a migration of its own. A token belonging to no user cannot authenticate
    # anything — the claims query inner-joins users — so any such row is unusable and is
    # removed rather than blocking the constraint.
    op.execute("DELETE FROM access_tokens WHERE user_id IS NULL OR refresh_token_id IS NULL")
    op.execute("DELETE FROM refresh_tokens WHERE user_id IS NULL")

    # table_kwargs preserves AUTOINCREMENT on SQLite, whose batch mode rebuilds
    # the table; without it, deleted primary keys could be reused.
    with op.batch_alter_table(
        "refresh_tokens",
        table_kwargs={"sqlite_autoincrement": True},
    ) as batch_op:
        batch_op.add_column(
            sa.Column(
                "oauth2_grant_id",
                _Integer,
                sa.ForeignKey("oauth2_grants.id", ondelete="CASCADE"),
                nullable=True,
            )
        )
        batch_op.add_column(sa.Column("scopes", JSON_, nullable=True))
        batch_op.add_column(sa.Column("audience", JSON_, nullable=True))
        # A rotated refresh token is retained as a tombstone rather than deleted, so a
        # later presentation of it is distinguishable from an unknown token. The row
        # still carries oauth2_grant_id, which identifies the token family to revoke.
        batch_op.add_column(sa.Column("consumed_at", sa.TIMESTAMP(timezone=True), nullable=True))
        batch_op.alter_column("user_id", existing_type=_Integer, nullable=False)
        batch_op.create_index("ix_refresh_tokens_oauth2_grant_id", ["oauth2_grant_id"])

    with op.batch_alter_table(
        "access_tokens",
        table_kwargs={"sqlite_autoincrement": True},
    ) as batch_op:
        batch_op.add_column(sa.Column("scopes", JSON_, nullable=True))
        batch_op.add_column(sa.Column("audience", JSON_, nullable=True))
        batch_op.alter_column("user_id", existing_type=_Integer, nullable=False)
        batch_op.alter_column("refresh_token_id", existing_type=_Integer, nullable=False)

    with op.batch_alter_table(
        "api_keys",
        table_kwargs={"sqlite_autoincrement": True},
    ) as batch_op:
        batch_op.add_column(sa.Column("scopes", JSON_, nullable=True))
        batch_op.add_column(sa.Column("audience", JSON_, nullable=True))


def downgrade() -> None:
    with op.batch_alter_table(
        "api_keys",
        table_kwargs={"sqlite_autoincrement": True},
    ) as batch_op:
        batch_op.drop_column("audience")
        batch_op.drop_column("scopes")

    with op.batch_alter_table(
        "access_tokens",
        table_kwargs={"sqlite_autoincrement": True},
    ) as batch_op:
        batch_op.alter_column("refresh_token_id", existing_type=_Integer, nullable=True)
        batch_op.alter_column("user_id", existing_type=_Integer, nullable=True)
        batch_op.drop_column("audience")
        batch_op.drop_column("scopes")

    with op.batch_alter_table(
        "refresh_tokens",
        table_kwargs={"sqlite_autoincrement": True},
    ) as batch_op:
        batch_op.alter_column("user_id", existing_type=_Integer, nullable=True)
        batch_op.drop_index("ix_refresh_tokens_oauth2_grant_id")
        batch_op.drop_column("consumed_at")
        batch_op.drop_column("audience")
        batch_op.drop_column("scopes")
        batch_op.drop_column("oauth2_grant_id")

    op.drop_index(
        "ix_oauth2_authorization_codes_expires_at",
        table_name="oauth2_authorization_codes",
    )
    op.drop_index(
        "ix_oauth2_authorization_codes_code_hash",
        table_name="oauth2_authorization_codes",
    )
    op.drop_table("oauth2_authorization_codes")
    op.drop_table("oauth2_grants")
    op.drop_index(
        "ix_oauth2_clients_registration_client_ip",
        table_name="oauth2_clients",
    )
    op.drop_index("ix_oauth2_clients_client_id", table_name="oauth2_clients")
    op.drop_table("oauth2_clients")
