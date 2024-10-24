from asyncio import sleep
from datetime import datetime

import pytest
from sqlalchemy import insert, select

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.types import DbSessionFactory


class Test_insert_on_conflict:
    @pytest.mark.parametrize(
        "on_conflict",
        [
            pytest.param(
                OnConflict.DO_NOTHING,
                id="do-nothing",
            ),
            pytest.param(
                OnConflict.DO_UPDATE,
                id="update",
            ),
        ],
    )
    async def test_inserts_new_tuple_when_no_conflict_is_present(
        self,
        on_conflict: OnConflict,
        db: DbSessionFactory,
    ) -> None:
        async with db() as session:
            dialect = SupportedSQLDialect(session.bind.dialect.name)
            values = dict(
                name="name",
                description="description",
            )
            await session.execute(
                insert_on_conflict(
                    values,
                    dialect=dialect,
                    table=models.Project,
                    unique_by=("name",),
                    on_conflict=on_conflict,
                )
            )
        projects = (await session.scalars(select(models.Project))).all()
        assert len(projects) == 1
        assert projects[0].name == "name"
        assert projects[0].description == "description"

    @pytest.mark.parametrize(
        "on_conflict",
        [
            pytest.param(
                OnConflict.DO_NOTHING,
                id="do-nothing",
            ),
            pytest.param(
                OnConflict.DO_UPDATE,
                id="do-update",
            ),
        ],
    )
    async def test_handles_conflicts_in_expected_manner(
        self,
        on_conflict: OnConflict,
        db: DbSessionFactory,
    ) -> None:
        async with db() as session:
            project_rowid = await session.scalar(
                insert(models.Project).values(dict(name="abc")).returning(models.Project.id)
            )
            trace_rowid = await session.scalar(
                insert(models.Trace)
                .values(
                    dict(
                        project_rowid=project_rowid,
                        trace_id="xyz",
                        start_time=datetime.now(),
                        end_time=datetime.now(),
                    )
                )
                .returning(models.Trace.id)
            )
            record = await session.scalar(
                insert(models.TraceAnnotation)
                .values(
                    dict(
                        name="uvw",
                        trace_rowid=trace_rowid,
                        annotator_kind="LLM",
                        score=12,
                        label="ijk",
                        metadata_={"1": "2"},
                    )
                )
                .returning(models.TraceAnnotation)
            )
            anno = await session.scalar(
                select(models.TraceAnnotation)
                .where(models.TraceAnnotation.trace_rowid == trace_rowid)
                .order_by(models.TraceAnnotation.created_at)
            )
        assert anno is not None
        assert record is not None
        assert anno.id == record.id
        assert anno.created_at == record.created_at
        assert anno.name == record.name
        assert anno.trace_rowid == record.trace_rowid
        assert anno.updated_at == record.updated_at
        assert anno.score == record.score
        assert anno.label == record.label
        assert anno.explanation == record.explanation
        assert anno.metadata_ == record.metadata_

        await sleep(1)  # increment `updated_at` by 1 second

        async with db() as session:
            dialect = SupportedSQLDialect(session.bind.dialect.name)
            await session.execute(
                insert_on_conflict(
                    dict(
                        name="uvw",
                        trace_rowid=trace_rowid,
                        annotator_kind="LLM",
                        score=None,
                        metadata_={},
                    ),
                    dict(
                        name="rst",
                        trace_rowid=trace_rowid,
                        annotator_kind="LLM",
                        score=12,
                        metadata_={"1": "2"},
                    ),
                    dict(
                        name="uvw",
                        trace_rowid=trace_rowid,
                        annotator_kind="HUMAN",
                        score=21,
                        metadata_={"2": "1"},
                    ),
                    dialect=dialect,
                    table=models.TraceAnnotation,
                    unique_by=("name", "trace_rowid"),
                    on_conflict=on_conflict,
                )
            )
            annos = list(
                await session.scalars(
                    select(models.TraceAnnotation)
                    .where(models.TraceAnnotation.trace_rowid == trace_rowid)
                    .order_by(models.TraceAnnotation.created_at)
                )
            )
        assert len(annos) == 2
        anno = annos[0]
        assert anno.id == record.id
        assert anno.created_at == record.created_at
        assert anno.name == record.name
        assert anno.trace_rowid == record.trace_rowid
        if on_conflict is OnConflict.DO_NOTHING:
            assert anno.updated_at == record.updated_at
            assert anno.annotator_kind == record.annotator_kind
            assert anno.score == record.score
            assert anno.label == record.label
            assert anno.explanation == record.explanation
            assert anno.metadata_ == record.metadata_
        else:
            assert anno.updated_at > record.updated_at
            assert anno.annotator_kind != record.annotator_kind
            assert anno.score == 21
            assert anno.label is None
            assert anno.explanation is None
            assert anno.metadata_ == {"2": "1"}
