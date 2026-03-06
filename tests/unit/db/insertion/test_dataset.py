from datetime import datetime, timezone

import pytest
from sqlalchemy import insert, select

from phoenix.db import models
from phoenix.db.insertion.dataset import (
    DatasetAction,
    ExampleContent,
    add_dataset_examples,
    bulk_assign_examples_to_splits,
    bulk_create_dataset_splits,
    compute_content_hash,
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


# ---------------------------------------------------------------------------
# Upsert helpers
# ---------------------------------------------------------------------------


async def _upsert(
    db: DbSessionFactory,
    name: str,
    examples: list[ExampleContent],
) -> None:
    async with db() as session:
        await add_dataset_examples(
            session=session,
            name=name,
            examples=examples,
            action=DatasetAction.UPSERT,
        )


async def _append(
    db: DbSessionFactory,
    name: str,
    examples: list[ExampleContent],
) -> None:
    async with db() as session:
        await add_dataset_examples(
            session=session,
            name=name,
            examples=examples,
            action=DatasetAction.APPEND,
        )


async def _get_revisions(db: DbSessionFactory, name: str) -> list[models.DatasetExampleRevision]:
    async with db() as session:
        result = await session.scalars(
            select(models.DatasetExampleRevision)
            .join(models.DatasetExample)
            .join(models.Dataset, models.DatasetExample.dataset_id == models.Dataset.id)
            .where(models.Dataset.name == name)
            .order_by(models.DatasetExampleRevision.id)
        )
        return list(result)


async def _get_versions(db: DbSessionFactory, name: str) -> list[models.DatasetVersion]:
    async with db() as session:
        result = await session.scalars(
            select(models.DatasetVersion)
            .join(models.Dataset)
            .where(models.Dataset.name == name)
            .order_by(models.DatasetVersion.id)
        )
        return list(result)


# ---------------------------------------------------------------------------
# Deduplication: matched pairs (8 tests)
# ---------------------------------------------------------------------------


async def test_upsert_ext_id_ext_id_matching_hash_carries_over(
    db: DbSessionFactory,
) -> None:
    """prev has ext_id, incoming has same ext_id, same hash → carry-over (no new version)."""
    name = "ds"
    ex = ExampleContent(input={"a": 1}, output={"b": 2}, external_id="e1")
    await _append(db, name, [ex])

    versions_before = await _get_versions(db, name)
    await _upsert(db, name, [ex])

    versions_after = await _get_versions(db, name)
    revisions = await _get_revisions(db, name)

    # No new version should be created
    assert len(versions_after) == len(versions_before)
    # Only the original CREATE revision
    assert len(revisions) == 1
    assert revisions[0].revision_kind == "CREATE"


async def test_upsert_ext_id_ext_id_differing_hash_adds_patch_revision(
    db: DbSessionFactory,
) -> None:
    """prev has ext_id, incoming has same ext_id, different hash → PATCH revision on same example."""
    name = "ds"
    await _append(db, name, [ExampleContent(input={"a": 1}, output={}, external_id="e1")])
    await _upsert(db, name, [ExampleContent(input={"a": 2}, output={}, external_id="e1")])

    revisions = await _get_revisions(db, name)
    versions = await _get_versions(db, name)

    assert len(versions) == 2
    assert len(revisions) == 2
    kinds = [r.revision_kind for r in revisions]
    assert "CREATE" in kinds
    assert "PATCH" in kinds
    # Both revisions belong to the same DatasetExample
    assert revisions[0].dataset_example_id == revisions[1].dataset_example_id


async def test_upsert_ext_id_no_ext_id_matching_hash_carries_over(
    db: DbSessionFactory,
) -> None:
    """prev has ext_id, incoming has no ext_id, same hash → carry-over via hash fallback."""
    name = "ds"
    inp = {"a": 1}
    # Set up prev with external_id
    await _append(db, name, [ExampleContent(input=inp, output={}, external_id="e1")])

    versions_before = await _get_versions(db, name)
    # Upsert with same content but no external_id
    await _upsert(db, name, [ExampleContent(input=inp, output={})])

    versions_after = await _get_versions(db, name)
    revisions = await _get_revisions(db, name)

    # carry-over: no new version
    assert len(versions_after) == len(versions_before)
    assert len(revisions) == 1


async def test_upsert_ext_id_no_ext_id_differing_hash_adds_delete_revision(
    db: DbSessionFactory,
) -> None:
    """prev has ext_id, incoming has no ext_id, different hash → DELETE old + CREATE new."""
    name = "ds"
    await _append(db, name, [ExampleContent(input={"a": 1}, output={}, external_id="e1")])
    await _upsert(db, name, [ExampleContent(input={"a": 2}, output={})])

    revisions = await _get_revisions(db, name)
    versions = await _get_versions(db, name)

    assert len(versions) == 2
    kinds = [r.revision_kind for r in revisions]
    assert "DELETE" in kinds
    assert "CREATE" in kinds


async def test_upsert_no_ext_id_ext_id_matching_hash_carries_over(
    db: DbSessionFactory,
) -> None:
    """prev has no ext_id, incoming has ext_id, same hash → carry-over; no external_id written."""
    name = "ds"
    inp = {"a": 1}
    await _append(db, name, [ExampleContent(input=inp, output={})])

    versions_before = await _get_versions(db, name)
    await _upsert(db, name, [ExampleContent(input=inp, output={}, external_id="new-id")])

    versions_after = await _get_versions(db, name)
    revisions = await _get_revisions(db, name)

    # carry-over: no new version
    assert len(versions_after) == len(versions_before)
    assert len(revisions) == 1

    # external_id NOT written to existing row (it was inserted without one)
    async with db() as session:
        example = await session.scalar(
            select(models.DatasetExample).join(models.Dataset).where(models.Dataset.name == name)
        )
    assert example is not None
    assert example.external_id is None


async def test_upsert_no_ext_id_ext_id_differing_hash_creates_and_deletes(
    db: DbSessionFactory,
) -> None:
    """prev has no ext_id, incoming has ext_id, different hash → CREATE new + DELETE old."""
    name = "ds"
    await _append(db, name, [ExampleContent(input={"a": 1}, output={})])
    await _upsert(db, name, [ExampleContent(input={"a": 2}, output={}, external_id="e1")])

    revisions = await _get_revisions(db, name)
    versions = await _get_versions(db, name)

    assert len(versions) == 2
    kinds = [r.revision_kind for r in revisions]
    assert "DELETE" in kinds
    assert "CREATE" in kinds


async def test_upsert_no_ext_id_no_ext_id_matching_hash_carries_over(
    db: DbSessionFactory,
) -> None:
    """prev has no ext_id, incoming has no ext_id, same hash → carry-over."""
    name = "ds"
    ex = ExampleContent(input={"a": 1}, output={})
    await _append(db, name, [ex])

    versions_before = await _get_versions(db, name)
    await _upsert(db, name, [ex])

    versions_after = await _get_versions(db, name)
    revisions = await _get_revisions(db, name)

    assert len(versions_after) == len(versions_before)
    assert len(revisions) == 1


async def test_upsert_no_ext_id_no_ext_id_differing_hash_creates_and_deletes(
    db: DbSessionFactory,
) -> None:
    """prev has no ext_id, incoming has no ext_id, different hash → CREATE new + DELETE old."""
    name = "ds"
    await _append(db, name, [ExampleContent(input={"a": 1}, output={})])
    await _upsert(db, name, [ExampleContent(input={"a": 2}, output={})])

    revisions = await _get_revisions(db, name)
    versions = await _get_versions(db, name)

    assert len(versions) == 2
    kinds = [r.revision_kind for r in revisions]
    assert "DELETE" in kinds
    assert "CREATE" in kinds


# ---------------------------------------------------------------------------
# Deduplication: deleted examples
# ---------------------------------------------------------------------------


async def test_upsert_deleted_ext_id_example_recreated_on_upsert(
    db: DbSessionFactory,
) -> None:
    """Deleted example with external_id → upserting same ext_id revives it (same row, new CREATE)."""
    name = "ds"
    # 1. Create example with ext_id="e1"
    await _append(db, name, [ExampleContent(input={"a": 1}, output={}, external_id="e1")])
    # 2. Upsert with a different example → "e1" gets DELETE
    await _upsert(db, name, [ExampleContent(input={"z": 99}, output={})])
    # 3. Upsert "e1" again → deleted "e1" revived with new CREATE revision on same row
    await _upsert(db, name, [ExampleContent(input={"a": 1}, output={}, external_id="e1")])

    async with db() as session:
        examples = list(
            await session.scalars(
                select(models.DatasetExample)
                .join(models.Dataset)
                .where(models.Dataset.name == name)
                .where(models.DatasetExample.external_id == "e1")
            )
        )
        revisions = list(
            await session.scalars(
                select(models.DatasetExampleRevision)
                .join(models.DatasetExample)
                .join(models.Dataset, models.DatasetExample.dataset_id == models.Dataset.id)
                .where(models.Dataset.name == name)
                .order_by(models.DatasetExampleRevision.id)
            )
        )

    # Only 1 DatasetExample row with ext_id="e1" (unique constraint; row revived)
    assert len(examples) == 1
    kinds = [r.revision_kind for r in revisions]
    # original CREATE, DELETE, revival CREATE (plus CREATE/DELETE for the {"z":99} example)
    assert kinds.count("CREATE") >= 2
    assert "DELETE" in kinds


async def test_upsert_deleted_no_ext_id_example_recreated_on_upsert(
    db: DbSessionFactory,
) -> None:
    """Deleted example (no ext_id) → upserting same content creates a new DatasetExample."""
    name = "ds"
    ex = ExampleContent(input={"a": 1}, output={})
    # 1. Create example
    await _append(db, name, [ex])
    # 2. Upsert with different content → original gets DELETE
    await _upsert(db, name, [ExampleContent(input={"z": 99}, output={})])
    # 3. Upsert original content again → deleted example absent from active → CREATE new row
    await _upsert(db, name, [ex])

    async with db() as session:
        all_examples = list(
            await session.scalars(
                select(models.DatasetExample)
                .join(models.Dataset)
                .where(models.Dataset.name == name)
            )
        )
        revisions = list(
            await session.scalars(
                select(models.DatasetExampleRevision)
                .join(models.DatasetExample)
                .join(models.Dataset, models.DatasetExample.dataset_id == models.Dataset.id)
                .where(models.Dataset.name == name)
                .order_by(models.DatasetExampleRevision.id)
            )
        )

    # At least 2 DatasetExample rows (original + new)
    assert len(all_examples) >= 2
    kinds = [r.revision_kind for r in revisions]
    assert kinds.count("CREATE") >= 2
    assert "DELETE" in kinds


# ---------------------------------------------------------------------------
# Deduplication: cardinality
# ---------------------------------------------------------------------------


async def test_upsert_same_hash_prev_one_req_many_adds_create_revision(
    db: DbSessionFactory,
) -> None:
    """1 prev, 2 req with same hash → 1 carry-over, 1 CREATE."""
    name = "ds"
    ex = ExampleContent(input={"a": 1}, output={})
    await _append(db, name, [ex])
    await _upsert(db, name, [ex, ex])

    revisions = await _get_revisions(db, name)
    versions = await _get_versions(db, name)

    assert len(versions) == 2
    kinds = [r.revision_kind for r in revisions]
    assert kinds.count("CREATE") == 2  # original CREATE + new CREATE for second
    assert "DELETE" not in kinds


async def test_upsert_same_hash_prev_many_req_one_adds_delete_revision(
    db: DbSessionFactory,
) -> None:
    """2 prev, 1 req with same hash → 1 carry-over, 1 DELETE."""
    name = "ds"
    ex = ExampleContent(input={"a": 1}, output={})
    await _append(db, name, [ex, ex])
    await _upsert(db, name, [ex])

    revisions = await _get_revisions(db, name)
    versions = await _get_versions(db, name)

    assert len(versions) == 2
    kinds = [r.revision_kind for r in revisions]
    assert "DELETE" in kinds
    assert kinds.count("CREATE") == 2  # two original CREATEs


# ---------------------------------------------------------------------------
# Mixed batches
# ---------------------------------------------------------------------------


async def test_upsert_batch_with_mix_of_new_unchanged_and_changed_examples(
    db: DbSessionFactory,
) -> None:
    """3 examples: unchanged (carry-over), changed (patch), new (create)."""
    name = "ds"
    e_unchanged = ExampleContent(input={"a": 1}, output={}, external_id="unchanged")
    e_changed_old = ExampleContent(input={"b": 1}, output={}, external_id="changed")
    e_changed_new = ExampleContent(input={"b": 2}, output={}, external_id="changed")
    e_new = ExampleContent(input={"c": 1}, output={}, external_id="new")

    await _append(db, name, [e_unchanged, e_changed_old])
    await _upsert(db, name, [e_unchanged, e_changed_new, e_new])

    revisions = await _get_revisions(db, name)
    versions = await _get_versions(db, name)

    assert len(versions) == 2
    kinds = [r.revision_kind for r in revisions]
    assert "PATCH" in kinds
    assert "CREATE" in kinds
    assert "DELETE" not in kinds
    # 2 original CREATEs + 1 PATCH + 1 new CREATE
    assert len(revisions) == 4


async def test_upsert_batch_with_mix_of_examples_with_and_without_external_ids(
    db: DbSessionFactory,
) -> None:
    """Mixed batch: examples with and without external_ids."""
    name = "ds"
    e_with_id = ExampleContent(input={"a": 1}, output={}, external_id="e1")
    e_no_id = ExampleContent(input={"b": 1}, output={})

    await _append(db, name, [e_with_id, e_no_id])
    # Upsert same examples
    await _upsert(db, name, [e_with_id, e_no_id])

    versions = await _get_versions(db, name)
    revisions = await _get_revisions(db, name)

    # Both carry-over → no new version
    assert len(versions) == 1
    assert len(revisions) == 2


# ---------------------------------------------------------------------------
# Dataset lifecycle
# ---------------------------------------------------------------------------


async def test_upsert_creates_new_dataset_when_name_does_not_exist(
    db: DbSessionFactory,
) -> None:
    """Upsert on non-existent dataset creates Dataset + DatasetVersion + CREATE revisions."""
    name = "brand-new"
    await _upsert(db, name, [ExampleContent(input={"x": 1}, output={})])

    async with db() as session:
        dataset = await session.scalar(select(models.Dataset).where(models.Dataset.name == name))
        assert dataset is not None

    versions = await _get_versions(db, name)
    revisions = await _get_revisions(db, name)

    assert len(versions) == 1
    assert len(revisions) == 1
    assert revisions[0].revision_kind == "CREATE"


async def test_upsert_creates_new_version_on_existing_dataset(
    db: DbSessionFactory,
) -> None:
    """Upsert with changes creates a second DatasetVersion."""
    name = "ds"
    await _append(db, name, [ExampleContent(input={"a": 1}, output={})])
    await _upsert(db, name, [ExampleContent(input={"a": 2}, output={})])

    versions = await _get_versions(db, name)
    assert len(versions) == 2


async def test_upsert_does_not_create_new_version_for_unchanged_examples(
    db: DbSessionFactory,
) -> None:
    """All carry-over → no new version, returns existing version_id."""
    name = "ds"
    ex = ExampleContent(input={"a": 1}, output={})
    await _append(db, name, [ex])

    versions_before = await _get_versions(db, name)
    prior_version_id = versions_before[0].id

    async with db() as session:
        event = await add_dataset_examples(
            session=session,
            name=name,
            examples=[ex],
            action=DatasetAction.UPSERT,
        )

    versions_after = await _get_versions(db, name)
    assert len(versions_after) == len(versions_before)
    assert event is not None
    assert event.dataset_version_id == prior_version_id


async def test_upsert_with_no_prior_version_creates_all_examples(
    db: DbSessionFactory,
) -> None:
    """Dataset exists but has no versions → all examples are new → CREATE all."""
    name = "ds"
    # Create dataset without any examples/versions
    async with db() as session:
        await session.execute(insert(models.Dataset).values(name=name, metadata_={}))

    await _upsert(
        db,
        name,
        [
            ExampleContent(input={"a": 1}, output={}),
            ExampleContent(input={"b": 2}, output={}),
        ],
    )

    versions = await _get_versions(db, name)
    revisions = await _get_revisions(db, name)

    assert len(versions) == 1
    assert len(revisions) == 2
    assert all(r.revision_kind == "CREATE" for r in revisions)


# ---------------------------------------------------------------------------
# Content hash correctness
# ---------------------------------------------------------------------------


async def test_upsert_examples_differing_only_in_key_order_share_same_content_hash(
    db: DbSessionFactory,
) -> None:
    """Two ExampleContent with same values but different key order → same content_hash."""
    ex1 = ExampleContent(input={"a": 1, "b": 2}, output={})
    ex2 = ExampleContent(input={"b": 2, "a": 1}, output={})

    h1 = compute_content_hash(ex1.input, ex1.output, ex1.metadata)
    h2 = compute_content_hash(ex2.input, ex2.output, ex2.metadata)
    assert h1 == h2

    name = "ds"
    await _append(db, name, [ex1])

    versions_before = await _get_versions(db, name)
    # Upsert ex2 (same content, different key order) → should carry-over
    await _upsert(db, name, [ex2])

    versions_after = await _get_versions(db, name)
    assert len(versions_after) == len(versions_before)
