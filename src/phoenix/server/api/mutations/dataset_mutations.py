from typing import Any, List, Optional

import strawberry
from openinference.semconv.trace import SpanAttributes
from sqlalchemy import insert, select
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.datasets_helpers import (
    get_dataset_example_input,
    get_dataset_example_output,
)
from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Span import Span


@strawberry.input
class AddSpansToDatasetInput:
    dataset_id: GlobalID
    span_ids: List[GlobalID]
    dataset_version_description: Optional[str] = UNSET
    dataset_version_metadata: Optional[JSON] = UNSET


@strawberry.type
class AddSpansToDatasetPayload:
    dataset: Dataset


@strawberry.type
class DatasetMutation:
    @strawberry.mutation
    async def create_dataset(
        self,
        info: Info[Context, None],
        name: str,
        description: Optional[str] = None,
        metadata: Optional[JSON] = None,
    ) -> Dataset:
        metadata = metadata or {}
        async with info.context.db() as session:
            result = await session.execute(
                insert(models.Dataset)
                .values(
                    name=name,
                    description=description,
                    metadata_=metadata,
                )
                .returning(
                    models.Dataset.id,
                    models.Dataset.name,
                    models.Dataset.description,
                    models.Dataset.created_at,
                    models.Dataset.updated_at,
                    models.Dataset.metadata_,
                )
            )
            if not (row := result.fetchone()):
                raise ValueError("Failed to create dataset")
            return Dataset(
                id_attr=row.id,
                name=row.name,
                description=row.description,
                created_at=row.created_at,
                updated_at=row.updated_at,
                metadata=row.metadata_,
            )

    @strawberry.mutation
    async def add_spans_to_dataset(
        self,
        info: Info[Context, None],
        input: AddSpansToDatasetInput,
    ) -> AddSpansToDatasetPayload:
        dataset_id = input.dataset_id
        span_ids = input.span_ids
        dataset_version_description = (
            input.dataset_version_description
            if isinstance(input.dataset_version_description, str)
            else None
        )
        dataset_version_metadata = input.dataset_version_metadata
        dataset_rowid = from_global_id_with_expected_type(
            global_id=dataset_id, expected_type_name=Dataset.__name__
        )
        span_rowids = {
            from_global_id_with_expected_type(global_id=span_id, expected_type_name=Span.__name__)
            for span_id in set(span_ids)
        }
        async with info.context.db() as session:
            if (
                dataset := await session.scalar(
                    select(models.Dataset).where(models.Dataset.id == dataset_rowid)
                )
            ) is None:
                raise ValueError(
                    f"Unknown dataset: {dataset_id}"
                )  # todo: implement error types https://github.com/Arize-ai/phoenix/issues/3221
            dataset_version_rowid = await session.scalar(
                insert(models.DatasetVersion)
                .values(
                    dataset_id=dataset_rowid,
                    description=dataset_version_description,
                    metadata_=dataset_version_metadata or {},
                )
                .returning(models.DatasetVersion.id)
            )
            spans = (
                await session.execute(
                    select(
                        models.Span.id,
                        models.Span.span_kind,
                        models.Span.attributes,
                        _span_attribute(INPUT_MIME_TYPE),
                        _span_attribute(INPUT_VALUE),
                        _span_attribute(OUTPUT_MIME_TYPE),
                        _span_attribute(OUTPUT_VALUE),
                        _span_attribute(LLM_PROMPT_TEMPLATE_VARIABLES),
                        _span_attribute(LLM_INPUT_MESSAGES),
                        _span_attribute(LLM_OUTPUT_MESSAGES),
                        _span_attribute(RETRIEVAL_DOCUMENTS),
                    )
                    .select_from(models.Span)
                    .where(models.Span.id.in_(span_rowids))
                )
            ).all()
            if missing_span_rowids := span_rowids - {span.id for span in spans}:
                raise ValueError(
                    f"Could not find spans with rowids: {', '.join(map(str, missing_span_rowids))}"
                )  # todo: implement error handling types https://github.com/Arize-ai/phoenix/issues/3221
            DatasetExample = models.DatasetExample
            dataset_example_rowids = (
                await session.scalars(
                    insert(DatasetExample).returning(DatasetExample.id),
                    [
                        {
                            DatasetExample.dataset_id.key: dataset_rowid,
                            DatasetExample.span_rowid.key: span.id,
                        }
                        for span in spans
                    ],
                )
            ).all()
            assert len(dataset_example_rowids) == len(spans)
            assert all(map(lambda id: isinstance(id, int), dataset_example_rowids))
            DatasetExampleRevision = models.DatasetExampleRevision
            await session.execute(
                insert(DatasetExampleRevision),
                [
                    {
                        DatasetExampleRevision.dataset_example_id.key: dataset_example_rowid,
                        DatasetExampleRevision.dataset_version_id.key: dataset_version_rowid,
                        DatasetExampleRevision.input.key: get_dataset_example_input(span),
                        DatasetExampleRevision.output.key: get_dataset_example_output(span),
                        DatasetExampleRevision.metadata_.key: span.attributes,
                        DatasetExampleRevision.revision_kind.key: "CREATE",
                    }
                    for dataset_example_rowid, span in zip(dataset_example_rowids, spans)
                ],
            )
        return AddSpansToDatasetPayload(
            dataset=Dataset(
                id_attr=dataset.id,
                name=dataset.name,
                description=dataset.description,
                created_at=dataset.created_at,
                updated_at=dataset.updated_at,
                metadata=dataset.metadata_,
            )
        )


def _span_attribute(semconv: str) -> Any:
    """
    Extracts an attribute from the ORM span attributes column and labels the
    result.

    E.g., "input.value" -> Span.attributes["input"]["value"].label("input_value")
    """
    attribute_value: Any = models.Span.attributes
    for key in semconv.split("."):
        attribute_value = attribute_value[key]
    return attribute_value.label(semconv.replace(".", "_"))


INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE
INPUT_VALUE = SpanAttributes.INPUT_VALUE
OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
LLM_PROMPT_TEMPLATE_VARIABLES = SpanAttributes.LLM_PROMPT_TEMPLATE_VARIABLES
LLM_INPUT_MESSAGES = SpanAttributes.LLM_INPUT_MESSAGES
LLM_OUTPUT_MESSAGES = SpanAttributes.LLM_OUTPUT_MESSAGES
RETRIEVAL_DOCUMENTS = SpanAttributes.RETRIEVAL_DOCUMENTS
