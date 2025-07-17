from abc import ABC, abstractmethod

from alembic.config import Config
from sqlalchemy import Engine
from typing_extensions import assert_never

from . import _DBBackend, _down, _get_table_schema_info, _TableSchemaInfo, _up, _verify_clean_state

_DOWN = "8a3764fe7f1a"
_UP = "6a88424799fe"


class DBSchemaComparisonTest(ABC):
    table_name: str

    @classmethod
    @abstractmethod
    def _get_current_schema_info(
        cls,
        db_backend: _DBBackend,
    ) -> _TableSchemaInfo: ...

    @classmethod
    @abstractmethod
    def _get_upgraded_schema_info(
        cls,
        db_backend: _DBBackend,
    ) -> _TableSchemaInfo: ...

    def _test_db_schema(
        self,
        _engine: Engine,
        _alembic_config: Config,
        _db_backend: _DBBackend,
        _schema: str,
    ) -> None:
        _verify_clean_state(_engine, _schema)

        _up(_engine, _alembic_config, _DOWN, _schema)

        current_info = self._get_current_schema_info(_db_backend)
        upgraded_info = self._get_upgraded_schema_info(_db_backend)

        with _engine.connect() as conn:
            initial_info = _get_table_schema_info(conn, self.table_name, _db_backend, _schema)
        assert (
            initial_info == current_info
        ), "Initial schema info does not match expected current schema info"

        _up(_engine, _alembic_config, _UP, _schema)

        with _engine.connect() as conn:
            final_info = _get_table_schema_info(conn, self.table_name, _db_backend, _schema)
        assert (
            final_info == upgraded_info
        ), "Final schema info does not match expected upgraded schema info"

        _down(_engine, _alembic_config, _DOWN, _schema)

        with _engine.connect() as conn:
            downgraded_info = _get_table_schema_info(conn, self.table_name, _db_backend, _schema)
        assert (
            downgraded_info == current_info
        ), "Downgraded schema info does not match expected current schema info"


class TestUsers(DBSchemaComparisonTest):
    table_name = "users"

    @classmethod
    def _get_current_schema_info(
        cls,
        db_backend: _DBBackend,
    ) -> _TableSchemaInfo:
        column_names = {
            "id",
            "user_role_id",
            "username",
            "email",
            "password_hash",
            "password_salt",
            "reset_password",
            "oauth2_client_id",
            "oauth2_user_id",
            "created_at",
            "updated_at",
            "profile_picture_url",
        }
        index_names = {
            "ix_users_username",
            "ix_users_email",
            "ix_users_oauth2_client_id",
            "ix_users_oauth2_user_id",
            "ix_users_user_role_id",
        }
        constraint_names = {
            "ck_users_`exactly_one_auth_method`",
            "ck_users_`oauth2_client_id_and_user_id`",
            "ck_users_`password_hash_and_salt`",
            "uq_users_oauth2_client_id_oauth2_user_id",
            "pk_users",
            "fk_users_user_role_id_user_roles",
        }
        if db_backend == "postgresql":
            index_names.update(
                {
                    "pk_users",
                    "uq_users_oauth2_client_id_oauth2_user_id",
                }
            )
        elif db_backend == "sqlite":
            index_names.update(
                {
                    "sqlite_autoindex_users_1",
                }
            )
        else:
            assert_never(db_backend)
        return _TableSchemaInfo(
            table_name="users",
            column_names=frozenset(column_names),
            index_names=frozenset(index_names),
            constraint_names=frozenset(constraint_names),
        )

    @classmethod
    def _get_upgraded_schema_info(
        cls,
        db_backend: _DBBackend,
    ) -> _TableSchemaInfo:
        column_names = {
            "id",
            "user_role_id",
            "username",
            "email",
            "password_hash",
            "password_salt",
            "reset_password",
            "oauth2_client_id",
            "oauth2_user_id",
            "created_at",
            "updated_at",
            "profile_picture_url",
            "auth_method",
        }
        index_names = {
            "ix_users_username",
            "ix_users_email",
            "ix_users_user_role_id",
        }
        constraint_names = {
            "ck_users_`valid_auth_method`",
            "ck_users_`local_auth_has_password_no_oauth`",
            "ck_users_`non_local_auth_has_no_password`",
            "uq_users_oauth2_client_id_oauth2_user_id",
            "pk_users",
            "fk_users_user_role_id_user_roles",
        }
        if db_backend == "postgresql":
            index_names.update(
                {
                    "pk_users",
                    "uq_users_oauth2_client_id_oauth2_user_id",
                }
            )
        elif db_backend == "sqlite":
            index_names.update(
                {
                    "sqlite_autoindex_users_1",
                }
            )
        else:
            assert_never(db_backend)
        return _TableSchemaInfo(
            table_name="users",
            column_names=frozenset(column_names),
            index_names=frozenset(index_names),
            constraint_names=frozenset(constraint_names),
        )

    def test_db_schema(
        self,
        _engine: Engine,
        _alembic_config: Config,
        _db_backend: _DBBackend,
        _schema: str,
    ) -> None:
        self._test_db_schema(_engine, _alembic_config, _db_backend, _schema)
