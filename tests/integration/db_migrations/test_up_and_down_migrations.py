import pytest
from alembic.config import Config
from sqlalchemy import (
    INTEGER,
    TIMESTAMP,
    VARCHAR,
    Engine,
    ForeignKeyConstraint,
    MetaData,
    PrimaryKeyConstraint,
    UniqueConstraint,
)

from . import _down, _up, _version_num


def test_up_and_down_migrations(
    _engine: Engine,
    _alembic_config: Config,
) -> None:
    with pytest.raises(BaseException, match="alembic_version"):
        _version_num(_engine)

    for _ in range(2):
        _up(_engine, _alembic_config, "cf03bd6bae1d")
        _down(_engine, _alembic_config, "base")
    _up(_engine, _alembic_config, "cf03bd6bae1d")

    for _ in range(2):
        _up(_engine, _alembic_config, "10460e46d750")
        _down(_engine, _alembic_config, "cf03bd6bae1d")
    _up(_engine, _alembic_config, "10460e46d750")

    for _ in range(2):
        _up(_engine, _alembic_config, "3be8647b87d8")
        _down(_engine, _alembic_config, "10460e46d750")
    _up(_engine, _alembic_config, "3be8647b87d8")

    for _ in range(2):
        _up(_engine, _alembic_config, "cd164e83824f")
        _down(_engine, _alembic_config, "3be8647b87d8")
    _up(_engine, _alembic_config, "cd164e83824f")

    for _ in range(2):
        _up(_engine, _alembic_config, "4ded9e43755f")

        metadata = MetaData()
        metadata.reflect(bind=_engine)

        assert (project_sessions := metadata.tables.get("project_sessions")) is not None

        columns = {str(col.name): col for col in project_sessions.columns}

        column = columns.pop("id", None)
        assert column is not None
        assert column.primary_key
        assert isinstance(column.type, INTEGER)
        del column

        column = columns.pop("session_id", None)
        assert column is not None
        assert not column.nullable
        assert isinstance(column.type, VARCHAR)
        del column

        column = columns.pop("project_id", None)
        assert column is not None
        assert not column.nullable
        assert isinstance(column.type, INTEGER)
        del column

        column = columns.pop("start_time", None)
        assert column is not None
        assert not column.nullable
        assert isinstance(column.type, TIMESTAMP)
        del column

        column = columns.pop("end_time", None)
        assert column is not None
        assert not column.nullable
        assert isinstance(column.type, TIMESTAMP)
        del column

        assert not columns
        del columns

        indexes = {str(idx.name): idx for idx in project_sessions.indexes}

        index = indexes.pop("ix_project_sessions_start_time", None)
        assert index is not None
        assert not index.unique
        del index

        index = indexes.pop("ix_project_sessions_end_time", None)
        assert index is not None
        assert not index.unique
        del index

        index = indexes.pop("ix_project_sessions_project_id", None)
        assert index is not None
        assert not index.unique
        del index

        assert not indexes
        del indexes

        constraints = {str(con.name): con for con in project_sessions.constraints}

        constraint = constraints.pop("pk_project_sessions", None)
        assert constraint is not None
        assert isinstance(constraint, PrimaryKeyConstraint)
        del constraint

        constraint = constraints.pop("uq_project_sessions_session_id", None)
        assert constraint is not None
        assert isinstance(constraint, UniqueConstraint)
        del constraint

        constraint = constraints.pop("fk_project_sessions_project_id_projects", None)
        assert constraint is not None
        assert isinstance(constraint, ForeignKeyConstraint)
        assert constraint.ondelete == "CASCADE"
        del constraint

        assert not constraints
        del constraints

        assert (traces := metadata.tables.get("traces")) is not None

        columns = {str(col.name): col for col in traces.columns}

        column = columns.pop("id", None)
        assert column is not None
        assert column.primary_key
        assert isinstance(column.type, INTEGER)
        del column

        column = columns.pop("trace_id", None)
        assert column is not None
        assert not column.nullable
        assert isinstance(column.type, VARCHAR)
        del column

        column = columns.pop("project_rowid", None)
        assert column is not None
        assert not column.nullable
        assert isinstance(column.type, INTEGER)
        del column

        column = columns.pop("start_time", None)
        assert column is not None
        assert not column.nullable
        assert isinstance(column.type, TIMESTAMP)
        del column

        column = columns.pop("end_time", None)
        assert column is not None
        assert not column.nullable
        assert isinstance(column.type, TIMESTAMP)
        del column

        column = columns.pop("project_session_rowid", None)
        assert column is not None
        assert column.nullable
        assert isinstance(column.type, INTEGER)
        del column

        assert not columns
        del columns

        indexes = {str(idx.name): idx for idx in traces.indexes}

        index = indexes.pop("ix_traces_project_rowid", None)
        assert index is not None
        assert not index.unique
        del index

        index = indexes.pop("ix_traces_start_time", None)
        assert index is not None
        assert not index.unique
        del index

        index = indexes.pop("ix_traces_project_session_rowid", None)
        assert index is not None
        assert not index.unique
        del index

        assert not indexes
        del indexes

        constraints = {str(con.name): con for con in traces.constraints}

        constraint = constraints.pop("pk_traces", None)
        assert isinstance(constraint, PrimaryKeyConstraint)
        del constraint

        constraint = constraints.pop("uq_traces_trace_id", None)
        assert isinstance(constraint, UniqueConstraint)
        del constraint

        constraint = constraints.pop("fk_traces_project_rowid_projects", None)
        assert isinstance(constraint, ForeignKeyConstraint)
        assert constraint.ondelete == "CASCADE"
        del constraint

        constraint = constraints.pop("fk_traces_project_session_rowid_project_sessions", None)
        assert isinstance(constraint, ForeignKeyConstraint)
        assert constraint.ondelete == "CASCADE"
        del constraint

        assert not constraints
        del constraints

        _down(_engine, _alembic_config, "cd164e83824f")

        metadata = MetaData()
        metadata.reflect(bind=_engine)

        assert metadata.tables.get("project_sessions") is None

        assert (traces := metadata.tables.get("traces")) is not None

        columns = {str(col.name): col for col in traces.columns}

        column = columns.pop("id", None)
        assert column is not None
        assert column.primary_key
        assert isinstance(column.type, INTEGER)
        del column

        column = columns.pop("trace_id", None)
        assert column is not None
        assert not column.nullable
        assert isinstance(column.type, VARCHAR)
        del column

        column = columns.pop("project_rowid", None)
        assert column is not None
        assert not column.nullable
        assert isinstance(column.type, INTEGER)
        del column

        column = columns.pop("start_time", None)
        assert column is not None
        assert not column.nullable
        assert isinstance(column.type, TIMESTAMP)
        del column

        column = columns.pop("end_time", None)
        assert column is not None
        assert not column.nullable
        assert isinstance(column.type, TIMESTAMP)
        del column

        assert not columns
        del columns

        indexes = {str(idx.name): idx for idx in traces.indexes}

        index = indexes.pop("ix_traces_project_rowid", None)
        assert index is not None
        assert not index.unique
        del index

        index = indexes.pop("ix_traces_start_time", None)
        assert index is not None
        assert not index.unique
        del index

        assert not indexes
        del indexes

        constraints = {str(con.name): con for con in traces.constraints}

        constraint = constraints.pop("pk_traces", None)
        assert isinstance(constraint, PrimaryKeyConstraint)
        del constraint

        constraint = constraints.pop("uq_traces_trace_id", None)
        assert isinstance(constraint, UniqueConstraint)
        del constraint

        constraint = constraints.pop("fk_traces_project_rowid_projects", None)
        assert isinstance(constraint, ForeignKeyConstraint)
        assert constraint.ondelete == "CASCADE"
        del constraint

        assert not constraints
        del constraints
    _up(_engine, _alembic_config, "4ded9e43755f")

    for _ in range(2):
        _up(_engine, _alembic_config, "bc8fea3c2bc8")
        _down(_engine, _alembic_config, "4ded9e43755f")
    _up(_engine, _alembic_config, "bc8fea3c2bc8")

    for _ in range(2):
        _up(_engine, _alembic_config, "2f9d1a65945f")
        _down(_engine, _alembic_config, "bc8fea3c2bc8")
    _up(_engine, _alembic_config, "2f9d1a65945f")

    for _ in range(2):
        _up(_engine, _alembic_config, "bb8139330879")
        _down(_engine, _alembic_config, "2f9d1a65945f")
    _up(_engine, _alembic_config, "bb8139330879")

    for _ in range(2):
        _up(_engine, _alembic_config, "8a3764fe7f1a")
        _down(_engine, _alembic_config, "bb8139330879")
    _up(_engine, _alembic_config, "8a3764fe7f1a")
