from asyncio import sleep
from typing import Any, Mapping, Optional

import pytest
from sqlalchemy import insert, select

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict, should_calculate_span_cost
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
            project_id = await session.scalar(
                insert(models.Project)
                .values(dict(name="abc", description="initial description"))
                .returning(models.Project.id)
            )
            project_record = await session.scalar(
                select(models.Project).where(models.Project.id == project_id)
            )
        assert project_record is not None

        async with db() as session:
            dialect = SupportedSQLDialect(session.bind.dialect.name)
            new_values = dict(name="abc", description="updated description")
            await sleep(1)
            await session.execute(
                insert_on_conflict(
                    new_values,
                    dialect=dialect,
                    table=models.Project,
                    unique_by=("name",),
                    on_conflict=on_conflict,
                )
            )
            updated_project = await session.scalar(
                select(models.Project).where(models.Project.id == project_id)
            )
        assert updated_project is not None

        if on_conflict is OnConflict.DO_NOTHING:
            assert updated_project.description == "initial description"
            assert updated_project.updated_at == project_record.updated_at
        else:
            assert updated_project.description == "updated description"
            assert updated_project.updated_at > project_record.updated_at


class TestShouldCalculateSpanCost:
    @pytest.mark.parametrize(
        "attributes,expected",
        [
            pytest.param(
                {
                    "openinference": {"span": {"kind": "LLM"}},
                    "llm": {"model_name": "gpt-4"},
                },
                True,
                id="valid_llm_span",
            ),
            pytest.param(
                None,
                False,
                id="attributes_is_none",
            ),
            pytest.param(
                {},
                False,
                id="attributes_is_empty",
            ),
            pytest.param(
                {"llm": {"model_name": "gpt-4"}},
                False,
                id="span_kind_is_missing",
            ),
            pytest.param(
                {
                    "openinference": {"span": {"kind": "TOOL"}},
                    "llm": {"model_name": "gpt-4"},
                },
                False,
                id="span_kind_is_not_llm",
            ),
            pytest.param(
                {
                    "openinference": {"span": {"kind": 123}},
                    "llm": {"model_name": "gpt-4"},
                },
                False,
                id="span_kind_is_not_string",
            ),
            pytest.param(
                {"openinference": {"span": {"kind": "LLM"}}},
                False,
                id="model_name_is_missing",
            ),
            pytest.param(
                {
                    "openinference": {"span": {"kind": "LLM"}},
                    "llm": {"model_name": 123},
                },
                False,
                id="model_name_is_not_string",
            ),
            pytest.param(
                {
                    "openinference": {"span": {"kind": "LLM"}},
                    "llm": {"model_name": ""},
                },
                False,
                id="model_name_is_empty_string",
            ),
            pytest.param(
                {
                    "openinference": {"span": {"kind": "LLM"}},
                    "llm": {"model_name": "   "},
                },
                False,
                id="model_name_is_whitespace_only",
            ),
            pytest.param(
                {
                    "openinference": {"span": {"kind": "LLM"}},
                    "llm": {"model_name": "  gpt-4  "},
                },
                True,
                id="model_name_has_leading_trailing_whitespace",
            ),
            pytest.param(
                {
                    "openinference": {"span": {"kind": "LLM"}},
                    "llm": {"model_name": "gpt-4"},
                },
                True,
                id="gpt-4",
            ),
            pytest.param(
                {
                    "openinference": {"span": {"kind": "LLM"}},
                    "llm": {"model_name": "gpt-3.5-turbo"},
                },
                True,
                id="gpt-3.5-turbo",
            ),
            pytest.param(
                {
                    "openinference": {"span": {"kind": "LLM"}},
                    "llm": {"model_name": "claude-3-opus"},
                },
                True,
                id="claude-3-opus",
            ),
            pytest.param(
                {
                    "openinference": {"span": {"kind": "LLM"}},
                    "llm": {"model_name": "llama-2-70b"},
                },
                True,
                id="llama-2-70b",
            ),
            pytest.param(
                {
                    "openinference": {"span": {"kind": "LLM"}},
                    "llm": {"model_name": "gemini-pro"},
                },
                True,
                id="gemini-pro",
            ),
            pytest.param(
                {"other_attribute": "some_value"},
                False,
                id="both_span_kind_and_model_name_are_missing",
            ),
            pytest.param(
                {
                    "openinference": {"span": {"kind": "llm"}},
                    "llm": {"model_name": "gpt-4"},
                },
                False,
                id="span_kind_lowercase",
            ),
            pytest.param(
                {
                    "openinference": {"span": {"kind": "LLM"}},
                    "llm": {"model_name": "a" * 1000},
                },
                True,
                id="very_long_model_name",
            ),
            pytest.param(
                {
                    "openinference": {"span": {"kind": "LLM"}},
                    "llm": {"model_name": "gpt-4\n"},
                },
                True,
                id="model_name_with_newline",
            ),
            pytest.param(
                {
                    "openinference": {"span": {"kind": "LLM"}},
                    "llm": {"model_name": "gpt-4\t"},
                },
                True,
                id="model_name_with_tab",
            ),
        ],
    )
    def test_should_calculate_span_cost(
        self,
        attributes: Optional[Mapping[str, Any]],
        expected: bool,
    ) -> None:
        """Test should_calculate_span_cost function with various inputs."""
        assert should_calculate_span_cost(attributes) is expected
