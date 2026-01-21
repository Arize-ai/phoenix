from datetime import datetime, timezone

from sqlalchemy import insert, select

from phoenix.db import models
from phoenix.db.insertion.dataset import ExampleContent, add_dataset_examples
from phoenix.server.types import DbSessionFactory


async def test_create_dataset(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        await add_dataset_examples(
            session=session,
            examples=[
                ExampleContent(input={"x": 1, "y": 2}, output={"z": 3}, metadata={"zz": 4}),
                ExampleContent(input={"x": 11, "y": 22}, output={"z": 33}, metadata={"zz": 44}),
            ],
            name="abc",
            description="xyz",
            metadata={"m": 0},
        )
    async with db() as session:
        data = await session.scalars(
            select(models.DatasetExampleRevision)
            .join(models.DatasetExample)
            .join_from(models.DatasetExample, models.Dataset)
            .where(models.Dataset.name == "abc")
            .where(models.Dataset.description == "xyz")
            .where(models.Dataset.metadata_["m"].as_float() == 0)
            .order_by(models.DatasetExampleRevision.id)
        )
    rev = next(data)
    assert rev.input == {"x": 1, "y": 2}
    assert rev.output == {"z": 3}
    assert rev.metadata_ == {"zz": 4}
    rev = next(data)
    assert rev.input == {"x": 11, "y": 22}
    assert rev.output == {"z": 33}
    assert rev.metadata_ == {"zz": 44}


async def test_create_dataset_with_span_links(
    db: DbSessionFactory,
) -> None:
    """Test that dataset examples can be linked to spans via span_id."""
    # First, create a trace and span to link to
    async with db() as session:
        # Create a project
        project_id = await session.scalar(
            insert(models.Project).values(name="test-project").returning(models.Project.id)
        )

        # Create a trace
        trace_id = await session.scalar(
            insert(models.Trace)
            .values(
                project_rowid=project_id,
                trace_id="test-trace-123",
                start_time=datetime.now(timezone.utc),
                end_time=datetime.now(timezone.utc),
            )
            .returning(models.Trace.id)
        )

        # Create spans
        span_rowid_1 = await session.scalar(
            insert(models.Span)
            .values(
                trace_rowid=trace_id,
                span_id="span-abc-123",
                name="test_span_1",
                span_kind="INTERNAL",
                start_time=datetime.now(timezone.utc),
                end_time=datetime.now(timezone.utc),
                attributes={},
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
            .returning(models.Span.id)
        )

        span_rowid_2 = await session.scalar(
            insert(models.Span)
            .values(
                trace_rowid=trace_id,
                span_id="span-def-456",
                name="test_span_2",
                span_kind="INTERNAL",
                start_time=datetime.now(timezone.utc),
                end_time=datetime.now(timezone.utc),
                attributes={},
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
            .returning(models.Span.id)
        )

        await session.commit()

    # Now create dataset with span links
    async with db() as session:
        await add_dataset_examples(
            session=session,
            examples=[
                ExampleContent(
                    input={"x": 1},
                    output={"z": 3},
                    span_id="span-abc-123",
                ),
                ExampleContent(
                    input={"x": 2},
                    output={"z": 6},
                    span_id="span-def-456",
                ),
                ExampleContent(
                    input={"x": 3},
                    output={"z": 9},
                    span_id="nonexistent-span",  # This span doesn't exist
                ),
                ExampleContent(
                    input={"x": 4},
                    output={"z": 12},
                    span_id=None,  # No span link
                ),
            ],
            name="dataset-with-spans",
        )

    # Verify the dataset examples are linked correctly
    async with db() as session:
        examples = await session.scalars(
            select(models.DatasetExample)
            .join(models.Dataset)
            .where(models.Dataset.name == "dataset-with-spans")
            .order_by(models.DatasetExample.id)
        )

        examples_list = list(examples)
        assert len(examples_list) == 4

        # First example should be linked to span 1
        assert examples_list[0].span_rowid == span_rowid_1

        # Second example should be linked to span 2
        assert examples_list[1].span_rowid == span_rowid_2

        # Third example should have no link (span doesn't exist)
        assert examples_list[2].span_rowid is None

        # Fourth example should have no link (no span_id provided)
        assert examples_list[3].span_rowid is None
