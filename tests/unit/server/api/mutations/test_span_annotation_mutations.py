import datetime
from typing import Any

import pytest
from strawberry.relay.types import GlobalID

from phoenix.db import models
from phoenix.server.api.types.AnnotationSource import AnnotationSource
from phoenix.server.api.types.AnnotatorKind import AnnotatorKind
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


@pytest.fixture(autouse=True)
async def span_data(db: DbSessionFactory) -> None:
    async with db() as session:
        project = models.Project(name="default")
        session.add(project)
        await session.flush()

        trace = models.Trace(
            project_rowid=project.id,
            trace_id="trace-1",
            start_time=datetime.datetime.now(),
            end_time=datetime.datetime.now(),
        )
        session.add(trace)
        await session.flush()

        # create two spans for tests (rowid=1 and rowid=2)
        span1 = models.Span(
            trace_rowid=trace.id,
            span_id="span1",
            name="span1",
            span_kind="internal",
            start_time=datetime.datetime.now(),
            end_time=datetime.datetime.now(),
            attributes={},
            events=[],
            status_code="OK",
            status_message="",
            cumulative_error_count=0,
            cumulative_llm_token_count_prompt=0,
            cumulative_llm_token_count_completion=0,
        )
        session.add(span1)

        span2 = models.Span(
            trace_rowid=trace.id,
            span_id="span2",
            name="span2",
            span_kind="internal",
            start_time=datetime.datetime.now(),
            end_time=datetime.datetime.now(),
            attributes={},
            events=[],
            status_code="OK",
            status_message="",
            cumulative_error_count=0,
            cumulative_llm_token_count_prompt=0,
            cumulative_llm_token_count_completion=0,
        )
        session.add(span2)

        await session.commit()


class TestSpanAnnotationMutations:
    CREATE_SPAN_ANNOTATIONS_MUTATION = """
    mutation CreateSpanAnnotations($input: [CreateSpanAnnotationInput!]!) {
      createSpanAnnotations(input: $input) {
        spanAnnotations {
          id
          name
          label
          score
          explanation
          identifier
        }
      }
    }
    """

    @pytest.mark.parametrize(
        "variables",
        [
            pytest.param(
                {
                    "input": [
                        {
                            "spanId": str(GlobalID("Span", "1")),
                            "name": "test_annotation",
                            "label": "LABEL1",
                            "score": 0.75,
                            "explanation": "Initial explanation",
                            "annotatorKind": AnnotatorKind.HUMAN.name,
                            "metadata": {},
                            "identifier": "",
                            "source": AnnotationSource.API.name,
                        }
                    ]
                },
                id="create-basic",
            ),
        ],
    )
    async def test_create_new_annotation_succeeds(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        variables: dict[str, Any],
    ) -> None:
        result = await gql_client.execute(self.CREATE_SPAN_ANNOTATIONS_MUTATION, variables)
        assert not result.errors
        assert result.data is not None
        data = result.data["createSpanAnnotations"]["spanAnnotations"][0]
        expected = variables["input"][0]
        assert data["name"] == expected["name"]
        assert data["label"] == expected["label"]
        assert data["score"] == expected["score"]
        assert data["explanation"] == expected["explanation"]
        assert data["identifier"] == ""
        assert isinstance(data["id"], str)

    async def test_upsert_on_conflict_updates_existing(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        # Initial creation
        span_gid = str(GlobalID("Span", "2"))
        base_input = {
            "spanId": span_gid,
            "name": "conflict_test",
            "label": "FIRST_LABEL",
            "score": 1.0,
            "explanation": "First",
            "annotatorKind": AnnotatorKind.HUMAN.name,
            "metadata": {},
            "identifier": "conflict",
            "source": AnnotationSource.APP.name,
        }
        variables1 = {"input": [base_input]}
        res1 = await gql_client.execute(self.CREATE_SPAN_ANNOTATIONS_MUTATION, variables1)
        assert not res1.errors
        ann1 = res1.data["createSpanAnnotations"]["spanAnnotations"][0]  # type: ignore
        id1 = ann1["id"]

        # Upsert with updated fields
        updated_input = base_input.copy()
        updated_input.update(
            {
                "label": "UPDATED_LABEL",
                "score": 2.0,
                "explanation": "Updated explanation",
            }
        )
        variables2 = {"input": [updated_input]}
        res2 = await gql_client.execute(self.CREATE_SPAN_ANNOTATIONS_MUTATION, variables2)
        assert not res2.errors
        ann2 = res2.data["createSpanAnnotations"]["spanAnnotations"][0]  # type: ignore
        id2 = ann2["id"]

        # IDs should match and values updated
        assert id1 == id2
        assert ann2["label"] == "UPDATED_LABEL"
        assert ann2["score"] == 2.0
        assert ann2["explanation"] == "Updated explanation"

    async def test_upsert_on_conflict_updates_existing_with_no_identifier(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        # Initial creation
        span_gid = str(GlobalID("Span", "2"))
        base_input = {
            "spanId": span_gid,
            "name": "conflict_test",
            "label": "FIRST_LABEL",
            "score": 1.0,
            "explanation": "First",
            "annotatorKind": AnnotatorKind.HUMAN.name,
            "metadata": {},
            "identifier": "",
            "source": AnnotationSource.APP.name,
        }
        variables1 = {"input": [base_input]}
        res1 = await gql_client.execute(self.CREATE_SPAN_ANNOTATIONS_MUTATION, variables1)
        assert not res1.errors
        ann1 = res1.data["createSpanAnnotations"]["spanAnnotations"][0]  # type: ignore
        id1 = ann1["id"]

        # Upsert with updated fields
        updated_input = base_input.copy()
        updated_input.update(
            {
                "label": "UPDATED_LABEL",
                "score": 2.0,
                "explanation": "Updated explanation",
            }
        )
        variables2 = {"input": [updated_input]}
        res2 = await gql_client.execute(self.CREATE_SPAN_ANNOTATIONS_MUTATION, variables2)
        assert not res2.errors
        ann2 = res2.data["createSpanAnnotations"]["spanAnnotations"][0]  # type: ignore
        id2 = ann2["id"]

        # IDs should match and values updated
        assert id1 == id2
        assert ann2["label"] == "UPDATED_LABEL"
        assert ann2["score"] == 2.0
        assert ann2["explanation"] == "Updated explanation"
