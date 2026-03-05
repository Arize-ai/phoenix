from datetime import datetime, timezone

import pytest
from sqlalchemy import insert, select

from phoenix.db import models
from phoenix.db.insertion.dataset import (
    ExampleContent,
    add_dataset_examples,
    bulk_assign_examples_to_splits,
    bulk_create_dataset_splits,
    resolve_span_ids_to_rowids,
)
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


async def test_resolve_span_ids_to_rowids_deduplicates_input(
    db: DbSessionFactory,
) -> None:
    """Test that resolve_span_ids_to_rowids deduplicates span IDs before querying.

    This is critical for performance: 10,000 examples referencing the same 5 span IDs
    should only consume 5 query parameters, not 10,000.
    """
    # Create a trace and span
    async with db() as session:
        project_id = await session.scalar(
            insert(models.Project).values(name="dedup-test-project").returning(models.Project.id)
        )
        trace_id = await session.scalar(
            insert(models.Trace)
            .values(
                project_rowid=project_id,
                trace_id="dedup-test-trace",
                start_time=datetime.now(timezone.utc),
                end_time=datetime.now(timezone.utc),
            )
            .returning(models.Trace.id)
        )
        span_rowid = await session.scalar(
            insert(models.Span)
            .values(
                trace_rowid=trace_id,
                span_id="duplicate-span-id",
                name="test_span",
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

    # Pass many duplicates of the same span ID
    span_ids_with_duplicates: list[str | None] = (
        ["duplicate-span-id"] * 100 + [None] * 50 + [""] * 25
    )

    async with db() as session:
        result = await resolve_span_ids_to_rowids(session, span_ids_with_duplicates)

    # Should still resolve correctly
    assert len(result) == 1
    assert result["duplicate-span-id"] == span_rowid


async def test_resolve_span_ids_to_rowids_batches_large_inputs(
    db: DbSessionFactory,
) -> None:
    """Test that resolve_span_ids_to_rowids processes large inputs in batches.

    With a small batch_size, we can verify batching works without creating
    thousands of spans.
    """
    # Create multiple spans
    async with db() as session:
        project_id = await session.scalar(
            insert(models.Project).values(name="batch-test-project").returning(models.Project.id)
        )
        trace_id = await session.scalar(
            insert(models.Trace)
            .values(
                project_rowid=project_id,
                trace_id="batch-test-trace",
                start_time=datetime.now(timezone.utc),
                end_time=datetime.now(timezone.utc),
            )
            .returning(models.Trace.id)
        )

        # Create 10 spans
        span_id_strs = [f"span-batch-{i}" for i in range(10)]
        span_rowids: dict[str, int] = {}
        for span_id in span_id_strs:
            rowid = await session.scalar(
                insert(models.Span)
                .values(
                    trace_rowid=trace_id,
                    span_id=span_id,
                    name=f"test_span_{span_id}",
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
            assert rowid is not None
            span_rowids[span_id] = rowid
        await session.commit()

    # Resolve with a small batch size to force multiple batches
    # Cast to list[str | None] as required by the function signature
    span_ids_input: list[str | None] = list(span_id_strs)
    async with db() as session:
        result = await resolve_span_ids_to_rowids(session, span_ids_input, batch_size=3)

    # All 10 spans should be resolved correctly
    assert len(result) == 10
    for span_id in span_id_strs:
        assert result[span_id] == span_rowids[span_id]


async def test_bulk_assign_examples_to_splits_batches_large_inputs(
    db: DbSessionFactory,
) -> None:
    """Test that bulk_assign_examples_to_splits processes large inputs in batches.

    With 2 params per row, large datasets with multiple splits can easily exceed
    the 32,767 parameter limit. This test verifies batching works correctly.
    """
    # Create a dataset with examples
    async with db() as session:
        await add_dataset_examples(
            session=session,
            examples=[ExampleContent(input={"x": i}, output={"z": i * 2}) for i in range(10)],
            name="batch-split-test",
        )

    # Get the example IDs
    async with db() as session:
        examples = await session.scalars(
            select(models.DatasetExample)
            .join(models.Dataset)
            .where(models.Dataset.name == "batch-split-test")
        )
        example_ids = [e.id for e in examples]

        # Create multiple splits
        split_name_to_id = await bulk_create_dataset_splits(
            session, {"split-a", "split-b", "split-c"}
        )

        # Create assignments (every example to every split = 30 assignments)
        assignments = [
            (example_id, split_id)
            for example_id in example_ids
            for split_id in split_name_to_id.values()
        ]

        # Use small batch_size to verify batching
        await bulk_assign_examples_to_splits(session, assignments, batch_size=5)
        await session.commit()

    # Verify all assignments were made
    async with db() as session:
        result = await session.execute(select(models.DatasetSplitDatasetExample))
        all_assignments = result.scalars().all()
        assert len(all_assignments) == 30  # 10 examples x 3 splits


async def test_bulk_assign_examples_to_splits_handles_duplicates(
    db: DbSessionFactory,
) -> None:
    """Test that bulk_assign_examples_to_splits handles duplicate assignments gracefully.

    The ON CONFLICT DO NOTHING clause should prevent errors from duplicates.
    """
    # Create a dataset with examples
    async with db() as session:
        await add_dataset_examples(
            session=session,
            examples=[
                ExampleContent(input={"x": 1}, output={"z": 2}),
            ],
            name="duplicate-split-test",
        )

    async with db() as session:
        examples = await session.scalars(
            select(models.DatasetExample)
            .join(models.Dataset)
            .where(models.Dataset.name == "duplicate-split-test")
        )
        example_id = next(iter(examples)).id

        split_name_to_id = await bulk_create_dataset_splits(session, {"test-split"})
        split_id = split_name_to_id["test-split"]

        # Assign the same example-split pair multiple times
        duplicate_assignments = [(example_id, split_id)] * 5

        # Should not raise an error
        await bulk_assign_examples_to_splits(session, duplicate_assignments)
        await session.commit()

    # Verify only one assignment exists
    async with db() as session:
        result = await session.execute(
            select(models.DatasetSplitDatasetExample).where(
                models.DatasetSplitDatasetExample.dataset_example_id == example_id
            )
        )
        all_assignments = result.scalars().all()
        assert len(all_assignments) == 1


async def test_add_dataset_examples_with_many_splits(
    db: DbSessionFactory,
) -> None:
    """Test end-to-end that creating examples with splits works correctly with batching.

    This tests the full flow through add_dataset_examples -> bulk_assign_examples_to_splits.
    """
    # Create 15 examples each belonging to 3 different splits
    examples = [
        ExampleContent(
            input={"x": i},
            output={"z": i * 2},
            splits=frozenset(["train", "eval", "test"]),
        )
        for i in range(15)
    ]

    async with db() as session:
        await add_dataset_examples(
            session=session,
            examples=examples,
            name="many-splits-dataset",
        )

    # Verify all examples have all splits assigned
    async with db() as session:
        result = await session.execute(
            select(models.DatasetSplitDatasetExample)
            .join(models.DatasetExample)
            .join(models.Dataset)
            .where(models.Dataset.name == "many-splits-dataset")
        )
        all_assignments = result.scalars().all()
        # 15 examples x 3 splits = 45 assignments
        assert len(all_assignments) == 45


@pytest.mark.parametrize("batch_size", [1, 3, 7, 100])
async def test_resolve_span_ids_to_rowids_various_batch_sizes(
    db: DbSessionFactory,
    batch_size: int,
) -> None:
    """Test that resolve_span_ids_to_rowids works correctly with various batch sizes."""
    # Create spans
    async with db() as session:
        project_id = await session.scalar(
            insert(models.Project)
            .values(name=f"batch-size-{batch_size}-project")
            .returning(models.Project.id)
        )
        trace_id = await session.scalar(
            insert(models.Trace)
            .values(
                project_rowid=project_id,
                trace_id=f"batch-size-{batch_size}-trace",
                start_time=datetime.now(timezone.utc),
                end_time=datetime.now(timezone.utc),
            )
            .returning(models.Trace.id)
        )

        # Create 10 spans
        expected_mappings: dict[str, int] = {}
        for i in range(10):
            span_id = f"span-size-{batch_size}-{i}"
            rowid = await session.scalar(
                insert(models.Span)
                .values(
                    trace_rowid=trace_id,
                    span_id=span_id,
                    name=f"test_span_{i}",
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
            assert rowid is not None
            expected_mappings[span_id] = rowid
        await session.commit()

    # Resolve with parameterized batch size
    async with db() as session:
        span_ids: list[str | None] = list(expected_mappings.keys())
        result = await resolve_span_ids_to_rowids(session, span_ids, batch_size=batch_size)

    assert result == expected_mappings


@pytest.mark.parametrize("batch_size", [1, 3, 7, 100])
async def test_bulk_assign_examples_to_splits_various_batch_sizes(
    db: DbSessionFactory,
    batch_size: int,
) -> None:
    """Test that bulk_assign_examples_to_splits works correctly with various batch sizes."""
    # Create a dataset with examples
    async with db() as session:
        await add_dataset_examples(
            session=session,
            examples=[ExampleContent(input={"x": i}, output={"z": i}) for i in range(5)],
            name=f"batch-size-{batch_size}-split-test",
        )

    async with db() as session:
        examples = await session.scalars(
            select(models.DatasetExample)
            .join(models.Dataset)
            .where(models.Dataset.name == f"batch-size-{batch_size}-split-test")
        )
        example_ids = [e.id for e in examples]

        split_name_to_id = await bulk_create_dataset_splits(session, {"split-x", "split-y"})

        # Create assignments (5 examples x 2 splits = 10 assignments)
        assignments = [
            (example_id, split_id)
            for example_id in example_ids
            for split_id in split_name_to_id.values()
        ]

        await bulk_assign_examples_to_splits(session, assignments, batch_size=batch_size)
        await session.commit()

    # Verify all assignments were made
    async with db() as session:
        result = await session.execute(
            select(models.DatasetSplitDatasetExample)
            .join(models.DatasetExample)
            .join(models.Dataset)
            .where(models.Dataset.name == f"batch-size-{batch_size}-split-test")
        )
        all_assignments = result.scalars().all()
        assert len(all_assignments) == 10
