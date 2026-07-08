import asyncio

from alembic import context
from sqlalchemy import Connection, engine_from_config, pool, text
from sqlalchemy.ext.asyncio import AsyncEngine

from phoenix.config import get_env_database_connection_str, get_env_database_schema
from phoenix.db.engines import get_async_db_url
from phoenix.db.models import Base
from phoenix.settings import Settings

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


# Resolve schema: empty string must become None so Alembic uses the default
# search path. When _schema is "", Alembic's has_table() checks for the
# version table in the "" namespace (which doesn't exist), misses the table
# in "public", and then CREATE TABLE fails with DuplicateTableError.
_schema = get_env_database_schema() or None


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        transaction_per_migration=True,
        version_table_schema=_schema,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = context.config.attributes.get("connection", None)
    if connectable is None:
        config = context.config.get_section(context.config.config_ini_section) or {}
        if "sqlalchemy.url" not in config:
            connection_str = get_env_database_connection_str()
            config["sqlalchemy.url"] = get_async_db_url(connection_str).render_as_string(
                hide_password=False
            )
        connectable = AsyncEngine(
            engine_from_config(
                config,
                prefix="sqlalchemy.",
                poolclass=pool.NullPool,
                future=True,
                echo=Settings.log_migrations,
            )
        )

    if isinstance(connectable, AsyncEngine):
        try:
            asyncio.get_running_loop()
        except RuntimeError:
            asyncio.run(run_async_migrations(connectable))
        else:
            asyncio.create_task(run_async_migrations(connectable))
    else:
        run_migrations(connectable)


async def run_async_migrations(connectable: AsyncEngine) -> None:
    async with connectable.connect() as connection:
        await connection.run_sync(run_migrations)


def run_migrations(connection: Connection) -> None:
    if _schema:
        connection.execute(text(f"CREATE SCHEMA IF NOT EXISTS {_schema}"))
        connection.execute(text(f"SET search_path TO {_schema}"))
    if connection.in_transaction():
        connection.commit()
    transaction = connection.begin()
    try:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            transactional_ddl=True,
            transaction_per_migration=True,
            version_table_schema=_schema,
        )
        context.run_migrations()
        transaction.commit()
    except Exception:
        transaction.rollback()
        raise


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
