import logging
from collections import deque
from collections.abc import Iterable, Iterator, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from itertools import chain
from typing import Any, Optional, cast

from sqlalchemy import func, insert, select
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect, get_dataset_example_revisions
from phoenix.db.insertion.helpers import DataManipulationEvent, OnConflict, insert_on_conflict
from phoenix.utilities.content_hashing import compute_example_content_hash

# Batch size for bulk inserts - tuned for good performance across SQLite and PostgreSQL
DEFAULT_BATCH_SIZE = 1000

logger = logging.getLogger(__name__)

DatasetId: TypeAlias = int
DatasetVersionId: TypeAlias = int
DatasetExampleId: TypeAlias = int
DatasetExampleRevisionId: TypeAlias = int
SpanRowId: TypeAlias = int
ExternalID: TypeAlias = str
ContentHash: TypeAlias = str


@dataclass(frozen=True)
class ExampleContent:
    input: dict[str, Any] = field(default_factory=dict)
    output: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)
    splits: frozenset[str] = field(default_factory=frozenset)  # Set of split names
    span_id: Optional[str] = None  # OTEL span ID for linking back to traces
    external_id: Optional[str] = None  # External identifier for upsert deduplication


Examples: TypeAlias = Iterable[ExampleContent]


@dataclass(frozen=True)
class DatasetExampleAdditionEvent(DataManipulationEvent):
    dataset_id: DatasetId
    dataset_version_id: DatasetVersionId


async def insert_dataset(
    session: AsyncSession,
    name: str,
    description: Optional[str] = None,
    metadata: Optional[Mapping[str, Any]] = None,
    created_at: Optional[datetime] = None,
    user_id: Optional[int] = None,
) -> DatasetId:
    id_ = await session.scalar(
        insert(models.Dataset)
        .values(
            name=name,
            description=description,
            metadata_=metadata,
            created_at=created_at,
            user_id=user_id,
        )
        .returning(models.Dataset.id)
    )
    return cast(DatasetId, id_)


async def insert_dataset_version(
    session: AsyncSession,
    dataset_id: DatasetId,
    description: Optional[str] = None,
    metadata: Optional[Mapping[str, Any]] = None,
    created_at: Optional[datetime] = None,
    user_id: Optional[int] = None,
) -> DatasetVersionId:
    id_ = await session.scalar(
        insert(models.DatasetVersion)
        .values(
            dataset_id=dataset_id,
            description=description,
            metadata_=metadata,
            created_at=created_at,
            user_id=user_id,
        )
        .returning(models.DatasetVersion.id)
    )
    return cast(DatasetVersionId, id_)


async def insert_dataset_example(
    session: AsyncSession,
    dataset_id: DatasetId,
    span_rowid: Optional[SpanRowId] = None,
    external_id: Optional[str] = None,
    created_at: Optional[datetime] = None,
) -> DatasetExampleId:
    id_ = await session.scalar(
        insert(models.DatasetExample)
        .values(
            dataset_id=dataset_id,
            span_rowid=span_rowid,
            external_id=external_id,
            created_at=created_at,
        )
        .returning(models.DatasetExample.id)
    )
    return cast(DatasetExampleId, id_)


class RevisionKind(Enum):
    CREATE = "CREATE"
    PATCH = "PATCH"
    DELETE = "DELETE"

    @classmethod
    def _missing_(cls, v: Any) -> "RevisionKind":
        if isinstance(v, str) and v and v.isascii() and not v.isupper():
            return cls(v.upper())
        raise ValueError(f"Invalid revision kind: {v}")


async def bulk_insert_dataset_examples(
    session: AsyncSession,
    dataset_id: DatasetId,
    span_rowids: Sequence[Optional[SpanRowId]],
    external_ids: Optional[Sequence[Optional[str]]] = None,
    created_at: Optional[datetime] = None,
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> list[DatasetExampleId]:
    """
    Bulk insert dataset examples and return their IDs in order.

    Args:
        session: Database session
        dataset_id: The dataset to add examples to
        span_rowids: List of span row IDs (or None) for each example, in order
        external_ids: Optional list of external IDs (or None) for each example, in order
        created_at: Timestamp for all examples
        batch_size: Number of records per batch insert

    Returns:
        List of created example IDs in the same order as span_rowids
    """
    if not span_rowids:
        return []

    all_ids: list[DatasetExampleId] = []

    # Process in batches
    for i in range(0, len(span_rowids), batch_size):
        batch = span_rowids[i : i + batch_size]
        batch_external_ids = external_ids[i : i + batch_size] if external_ids is not None else None
        records = [
            {
                "dataset_id": dataset_id,
                "span_rowid": span_rowid,
                "external_id": batch_external_ids[batch_idx]
                if batch_external_ids is not None
                else None,
                "created_at": created_at,
            }
            for batch_idx, span_rowid in enumerate(batch)
        ]

        # Use INSERT ... RETURNING to get IDs in order
        result = await session.execute(
            insert(models.DatasetExample).values(records).returning(models.DatasetExample.id)
        )
        batch_ids = [cast(DatasetExampleId, row[0]) for row in result.fetchall()]
        all_ids.extend(batch_ids)

    return all_ids


async def bulk_insert_dataset_example_revisions(
    session: AsyncSession,
    dataset_version_id: DatasetVersionId,
    example_ids: Sequence[DatasetExampleId],
    examples: Sequence[ExampleContent],
    revision_kind: RevisionKind = RevisionKind.CREATE,
    created_at: Optional[datetime] = None,
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> list[DatasetExampleRevisionId]:
    """
    Bulk insert dataset example revisions.

    Args:
        session: Database session
        dataset_version_id: The version to add revisions to
        example_ids: List of example IDs (must match order of examples)
        examples: List of example content
        revision_kind: The kind of revision (CREATE, PATCH, DELETE)
        created_at: Timestamp for all revisions
        batch_size: Number of records per batch insert

    Returns:
        List of created revision IDs in order
    """
    if not example_ids or not examples:
        return []

    if len(example_ids) != len(examples):
        raise ValueError(
            f"example_ids and examples must have same length: {len(example_ids)} != {len(examples)}"
        )

    all_ids: list[DatasetExampleRevisionId] = []

    # Process in batches
    for i in range(0, len(example_ids), batch_size):
        batch_example_ids = example_ids[i : i + batch_size]
        batch_examples = examples[i : i + batch_size]

        records = [
            {
                "dataset_version_id": dataset_version_id,
                "dataset_example_id": example_id,
                "input": example.input,
                "output": example.output,
                "metadata_": example.metadata,
                "content_hash": compute_example_content_hash(
                    input=example.input, output=example.output, metadata=example.metadata
                ),
                "revision_kind": revision_kind.value,
                "created_at": created_at,
            }
            for example_id, example in zip(batch_example_ids, batch_examples)
        ]

        result = await session.execute(
            insert(models.DatasetExampleRevision)
            .values(records)
            .returning(models.DatasetExampleRevision.id)
        )
        batch_ids = [cast(DatasetExampleRevisionId, row[0]) for row in result.fetchall()]
        all_ids.extend(batch_ids)

    return all_ids


async def insert_dataset_example_revision(
    session: AsyncSession,
    dataset_version_id: DatasetVersionId,
    dataset_example_id: DatasetExampleId,
    input: dict[str, Any],
    output: dict[str, Any],
    metadata: dict[str, Any],
    revision_kind: RevisionKind = RevisionKind.CREATE,
    content_hash: Optional[str] = None,
    created_at: Optional[datetime] = None,
) -> DatasetExampleRevisionId:
    id_ = await session.scalar(
        insert(models.DatasetExampleRevision)
        .values(
            dataset_version_id=dataset_version_id,
            dataset_example_id=dataset_example_id,
            input=input,
            output=output,
            metadata_=metadata,
            revision_kind=revision_kind.value,
            content_hash=content_hash,
            created_at=created_at,
        )
        .returning(models.DatasetExampleRevision.id)
    )
    return cast(DatasetExampleRevisionId, id_)


async def resolve_span_ids_to_rowids(
    session: AsyncSession,
    span_ids: list[Optional[str]],
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> dict[str, int]:
    """
    Batch resolve span_id strings to database row IDs.

    Args:
        session: Database session
        span_ids: List of OTEL span ID strings (duplicates are handled efficiently)
        batch_size: Number of span IDs per query batch (default: DEFAULT_BATCH_SIZE)

    Returns:
        Dictionary mapping span_id to Span.id (database row ID)
    """
    # Filter out None and empty strings, then deduplicate
    # Deduplication is critical: 10,000 examples referencing the same 5 span IDs
    # should only use 5 query parameters, not 10,000
    unique_span_ids = {sid for sid in span_ids if sid}
    if not unique_span_ids:
        return {}

    # Build mapping of span_id (string) to span row ID (int)
    span_id_to_rowid: dict[str, int] = {}

    # Process in batches to avoid exceeding database parameter limits
    # (e.g., SQLite's 32,767 limit for bound parameters)
    unique_span_ids_list = list(unique_span_ids)
    for i in range(0, len(unique_span_ids_list), batch_size):
        batch = unique_span_ids_list[i : i + batch_size]

        # Query spans table for matching span_ids in this batch
        result = await session.execute(
            select(models.Span.span_id, models.Span.id).where(models.Span.span_id.in_(batch))
        )

        for span_id, row_id in result.all():
            span_id_to_rowid[span_id] = row_id

    # Log warnings for span IDs that couldn't be resolved
    missing_span_ids = unique_span_ids - set(span_id_to_rowid.keys())
    if missing_span_ids:
        logger.warning(
            f"Could not resolve {len(missing_span_ids)} span IDs to database records. "
            f"Examples will be created without span links."
        )

    return span_id_to_rowid


async def bulk_create_dataset_splits(
    session: AsyncSession,
    split_names: set[str],
    user_id: Optional[int] = None,
) -> dict[str, int]:
    """
    Bulk create dataset splits using upsert pattern.
    Returns a mapping of split name to split ID.
    """
    if not split_names:
        return {}

    dialect = SupportedSQLDialect(session.bind.dialect.name)
    records: list[dict[str, Any]] = [
        {
            "name": name,
            "color": "#808080",  # Default gray color
            "metadata_": {},
            "user_id": user_id,
        }
        for name in split_names
    ]

    # Bulk upsert all splits - uses ON CONFLICT DO NOTHING to handle race conditions
    stmt = insert_on_conflict(
        *records,
        table=models.DatasetSplit,
        dialect=dialect,
        unique_by=["name"],
        on_conflict=OnConflict.DO_NOTHING,
    )
    await session.execute(stmt)

    # Fetch all split IDs by name
    result = await session.execute(
        select(models.DatasetSplit.name, models.DatasetSplit.id).where(
            models.DatasetSplit.name.in_(split_names)
        )
    )
    return {name: split_id for name, split_id in result.all()}


async def bulk_assign_examples_to_splits(
    session: AsyncSession,
    assignments: list[tuple[DatasetExampleId, int]],
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> None:
    """
    Bulk assign examples to splits.
    assignments is a list of (dataset_example_id, dataset_split_id) tuples.

    Args:
        session: Database session
        assignments: List of (dataset_example_id, dataset_split_id) tuples
        batch_size: Number of records per batch insert (default: DEFAULT_BATCH_SIZE)
    """
    if not assignments:
        return

    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from sqlalchemy.dialects.sqlite import insert as sqlite_insert
    from typing_extensions import assert_never

    dialect = SupportedSQLDialect(session.bind.dialect.name)

    # Process in batches to avoid exceeding database parameter limits
    # (e.g., SQLite's 32,767 limit, PostgreSQL's similar constraints)
    for i in range(0, len(assignments), batch_size):
        batch = assignments[i : i + batch_size]
        records = [
            {
                "dataset_example_id": example_id,
                "dataset_split_id": split_id,
            }
            for example_id, split_id in batch
        ]

        # Use index_elements instead of constraint name because the table uses
        # a PrimaryKeyConstraint, not a unique constraint
        if dialect is SupportedSQLDialect.POSTGRESQL:
            pg_stmt = pg_insert(models.DatasetSplitDatasetExample).values(records)
            await session.execute(
                pg_stmt.on_conflict_do_nothing(
                    index_elements=["dataset_split_id", "dataset_example_id"]
                )
            )
        elif dialect is SupportedSQLDialect.SQLITE:
            sqlite_stmt = sqlite_insert(models.DatasetSplitDatasetExample).values(records)
            await session.execute(
                sqlite_stmt.on_conflict_do_nothing(
                    index_elements=["dataset_split_id", "dataset_example_id"]
                )
            )
        else:
            assert_never(dialect)


class DatasetAction(Enum):
    CREATE = "create"
    APPEND = "append"
    UPSERT = "upsert"

    @classmethod
    def _missing_(cls, v: Any) -> "DatasetAction":
        if isinstance(v, str) and v and v.isascii() and not v.islower():
            return cls(v.lower())
        raise ValueError(f"Invalid dateset action: {v}")


async def _get_external_ids_and_content_hashes_for_most_recent_version(
    session: AsyncSession,
    dataset_id: DatasetId,
) -> list[tuple[DatasetExampleId, ExternalID, ContentHash]]:
    """Return (example_id, external_id, content_hash) for all active (non-deleted) examples."""
    latest_version_id = await session.scalar(
        select(func.max(models.DatasetVersion.id)).where(
            models.DatasetVersion.dataset_id == dataset_id
        )
    )
    if latest_version_id is None:
        return []

    revisions_subq = get_dataset_example_revisions(
        latest_version_id, dataset_id=dataset_id
    ).subquery()

    result = await session.execute(
        select(
            revisions_subq.c.dataset_example_id,
            models.DatasetExample.external_id,
            revisions_subq.c.content_hash,
        )
        .join(
            models.DatasetExample, models.DatasetExample.id == revisions_subq.c.dataset_example_id
        )
        .where(revisions_subq.c.content_hash.isnot(None))
    )

    return [(row.dataset_example_id, row.external_id, row.content_hash) for row in result]


async def add_dataset_examples(
    session: AsyncSession,
    name: str,
    examples: Examples,
    description: Optional[str] = None,
    metadata: Optional[Mapping[str, Any]] = None,
    action: DatasetAction = DatasetAction.CREATE,
    user_id: Optional[int] = None,
) -> Optional[DatasetExampleAdditionEvent]:
    created_at = datetime.now(timezone.utc)

    if action is DatasetAction.UPSERT:
        return await _upsert_dataset_examples(
            session=session,
            name=name,
            examples=examples,
            description=description,
            metadata=metadata,
            user_id=user_id,
            created_at=created_at,
        )

    dataset_id: Optional[DatasetId] = None
    if action is DatasetAction.APPEND and name:
        dataset_id = await session.scalar(
            select(models.Dataset.id).where(models.Dataset.name == name)
        )
    if action is DatasetAction.CREATE or dataset_id is None:
        try:
            dataset_id = await insert_dataset(
                session=session,
                name=name,
                description=description,
                metadata=metadata,
                created_at=created_at,
                user_id=user_id,
            )
        except Exception:
            logger.exception(f"Failed to insert dataset: {name=}")
            raise
    try:
        dataset_version_id = await insert_dataset_version(
            session=session,
            dataset_id=dataset_id,
            created_at=created_at,
            user_id=user_id,
        )
    except Exception:
        logger.exception(f"Failed to insert dataset version for {dataset_id=}")
        raise

    # Collect all examples first to batch resolve span IDs
    examples_list = list(examples)

    if not examples_list:
        return DatasetExampleAdditionEvent(
            dataset_id=dataset_id, dataset_version_id=dataset_version_id
        )

    # Batch resolve span IDs to row IDs
    span_ids_to_resolve = [ex.span_id for ex in examples_list]
    span_id_to_rowid = await resolve_span_ids_to_rowids(session, span_ids_to_resolve)

    # Prepare span_rowids and external_ids lists for bulk insert (preserving order)
    span_rowids: list[Optional[SpanRowId]] = [
        span_id_to_rowid.get(ex.span_id) if ex.span_id else None for ex in examples_list
    ]
    external_ids: list[Optional[str]] = [example.external_id for example in examples_list]

    # Bulk insert all examples at once
    try:
        example_ids = await bulk_insert_dataset_examples(
            session=session,
            dataset_id=dataset_id,
            span_rowids=span_rowids,
            external_ids=external_ids,
            created_at=created_at,
        )
    except Exception:
        logger.exception(f"Failed to bulk insert dataset examples for {dataset_id=}")
        raise

    # Bulk insert all revisions at once
    try:
        await bulk_insert_dataset_example_revisions(
            session=session,
            dataset_version_id=dataset_version_id,
            example_ids=example_ids,
            examples=examples_list,
            created_at=created_at,
        )
    except Exception:
        logger.exception(
            f"Failed to bulk insert dataset example revisions for {dataset_version_id=}"
        )
        raise

    # Collect split assignments by name for bulk insert
    split_assignments: list[tuple[DatasetExampleId, str]] = []
    for example_id, example in zip(example_ids, examples_list):
        for split_name in example.splits:
            split_assignments.append((example_id, split_name))

    # Bulk create splits and assign examples after iteration
    if split_assignments:
        # Collect all unique split names
        all_split_names = {name for _, name in split_assignments}
        try:
            split_name_to_id = await bulk_create_dataset_splits(
                session=session,
                split_names=all_split_names,
                user_id=user_id,
            )
        except Exception:
            logger.exception(f"Failed to bulk create dataset splits: {all_split_names}")
            raise

        # Convert name-based assignments to ID-based assignments
        id_assignments = [
            (example_id, split_name_to_id[split_name])
            for example_id, split_name in split_assignments
        ]

        try:
            await bulk_assign_examples_to_splits(
                session=session,
                assignments=id_assignments,
            )
        except Exception:
            logger.exception("Failed to bulk assign examples to splits")
            raise

    return DatasetExampleAdditionEvent(dataset_id=dataset_id, dataset_version_id=dataset_version_id)


async def _upsert_dataset_examples(
    session: AsyncSession,
    name: str,
    examples: Examples,
    description: Optional[str] = None,
    metadata: Optional[Mapping[str, Any]] = None,
    user_id: Optional[int] = None,
    created_at: Optional[datetime] = None,
) -> Optional[DatasetExampleAdditionEvent]:
    examples_ = list(examples)
    if created_at is None:
        created_at = datetime.now(timezone.utc)

    dataset_id: Optional[DatasetId] = await session.scalar(
        select(models.Dataset.id).where(models.Dataset.name == name)
    )
    if dataset_id is None:
        dataset_id = await insert_dataset(
            session=session,
            name=name,
            description=description,
            metadata=metadata,
            created_at=created_at,
            user_id=user_id,
        )

    # Get active previous examples (non-deleted)
    previous = await _get_external_ids_and_content_hashes_for_most_recent_version(
        session, dataset_id
    )

    # Compute content hash for each incoming example
    incoming: list[tuple[ExampleContent, str]] = [
        (
            example,
            compute_example_content_hash(
                input=example.input,
                output=example.output,
                metadata=example.metadata,
            ),
        )
        for example in examples_
    ]

    # Build lookup maps
    # ext_id_map: external_id → (example_id, prev_content_hash)  [only entries with external_id]
    # hash_map: content_hash → deque of example_ids              [ALL previous examples]
    ext_id_map: dict[ExternalID, tuple[DatasetExampleId, ContentHash]] = {}
    hash_map: dict[ContentHash, deque[DatasetExampleId]] = {}

    for example_id, external_id, content_hash in previous:
        if external_id is not None:
            ext_id_map[external_id] = (example_id, content_hash)
        dq = hash_map.setdefault(content_hash, deque())
        dq.append(example_id)

    consumed: set[DatasetExampleId] = set()
    carry_over: list[tuple[ExampleContent, DatasetExampleId]] = []
    patch: list[tuple[ExampleContent, DatasetExampleId, str]] = []
    to_create: list[tuple[ExampleContent, str]] = []

    for example, content_hash in incoming:
        matched_id: Optional[DatasetExampleId] = None
        prev_hash: Optional[str] = None

        if example.external_id is not None and example.external_id in ext_id_map:
            # Priority: match by external_id
            matched_id, prev_hash = ext_id_map[example.external_id]
            consumed.add(matched_id)
            # Remove from hash_map to prevent double-consumption
            if prev_hash in hash_map:
                dq = hash_map[prev_hash]
                try:
                    dq.remove(matched_id)
                except ValueError:
                    pass
                if not dq:
                    del hash_map[prev_hash]
        else:
            # Fallback: match by content hash
            if content_hash in hash_map:
                dq = hash_map[content_hash]
                # Skip already-consumed IDs
                while dq and dq[0] in consumed:
                    dq.popleft()
                if dq:
                    matched_id = dq.popleft()
                    prev_hash = content_hash
                    consumed.add(matched_id)
                    if not dq:
                        del hash_map[content_hash]

        if matched_id is None:
            to_create.append((example, content_hash))
        elif content_hash == prev_hash:
            carry_over.append((example, matched_id))
        else:
            patch.append((example, matched_id, content_hash))

    # Previous examples not consumed → need DELETE revisions
    all_previous_ids = {ex_id for ex_id, _, _ in previous}
    to_delete = [ex_id for ex_id in all_previous_ids if ex_id not in consumed]

    # No changes → return event with existing latest version (no new version created)
    if not patch and not to_create and not to_delete:
        latest_version_id = await session.scalar(
            select(models.DatasetVersion.id)
            .where(models.DatasetVersion.dataset_id == dataset_id)
            .order_by(models.DatasetVersion.created_at.desc())
            .limit(1)
        )
        if latest_version_id is not None:
            return DatasetExampleAdditionEvent(
                dataset_id=dataset_id, dataset_version_id=latest_version_id
            )

    # Create new dataset version
    dataset_version_id = await insert_dataset_version(
        session=session,
        dataset_id=dataset_id,
        created_at=created_at,
        user_id=user_id,
    )

    # Apply PATCH revisions (existing examples with changed content)
    for example, example_id, new_hash in patch:
        await insert_dataset_example_revision(
            session=session,
            dataset_version_id=dataset_version_id,
            dataset_example_id=example_id,
            input=example.input,
            output=example.output,
            metadata=example.metadata,
            revision_kind=RevisionKind.PATCH,
            content_hash=new_hash,
            created_at=created_at,
        )

    # Apply DELETE revisions (previous examples not present in new upsert)
    for example_id in to_delete:
        await insert_dataset_example_revision(
            session=session,
            dataset_version_id=dataset_version_id,
            dataset_example_id=example_id,
            input={},
            output={},
            metadata={},
            revision_kind=RevisionKind.DELETE,
            content_hash=None,
            created_at=created_at,
        )

    # Create new examples and their CREATE revisions
    if to_create:
        # Check for deleted examples with matching external_ids (revival case).
        # The (dataset_id, external_id) unique constraint prevents creating a new row
        # if one already exists for that external_id, so we revive the existing row.
        create_ext_ids = [ex.external_id for ex, _ in to_create if ex.external_id is not None]
        deleted_ext_id_to_example_id: dict[str, DatasetExampleId] = {}
        if create_ext_ids:
            revivable = await session.execute(
                select(models.DatasetExample.external_id, models.DatasetExample.id)
                .where(models.DatasetExample.dataset_id == dataset_id)
                .where(models.DatasetExample.external_id.in_(create_ext_ids))
            )
            for eid, ex_id in revivable.all():
                if eid is not None:
                    deleted_ext_id_to_example_id[eid] = ex_id

        span_ids_to_resolve = [ex.span_id for ex, _ in to_create]
        span_id_to_rowid = await resolve_span_ids_to_rowids(session, span_ids_to_resolve)
        split_assignments: list[tuple[DatasetExampleId, str]] = []

        for example, content_hash in to_create:
            span_rowid = None
            if example.span_id:
                span_rowid = span_id_to_rowid.get(example.span_id)

            if (
                example.external_id is not None
                and example.external_id in deleted_ext_id_to_example_id
            ):
                # Revive the existing (deleted) example row
                new_example_id = deleted_ext_id_to_example_id[example.external_id]
            else:
                new_example_id = await insert_dataset_example(
                    session=session,
                    dataset_id=dataset_id,
                    span_rowid=span_rowid,
                    external_id=example.external_id,
                    created_at=created_at,
                )
            await insert_dataset_example_revision(
                session=session,
                dataset_version_id=dataset_version_id,
                dataset_example_id=new_example_id,
                input=example.input,
                output=example.output,
                metadata=example.metadata,
                revision_kind=RevisionKind.CREATE,
                content_hash=content_hash,
                created_at=created_at,
            )

            for split_name in example.splits:
                split_assignments.append((new_example_id, split_name))

        if split_assignments:
            all_split_names = {sn for _, sn in split_assignments}
            split_name_to_id = await bulk_create_dataset_splits(
                session=session,
                split_names=all_split_names,
                user_id=user_id,
            )
            id_assignments = [(eid, split_name_to_id[sn]) for eid, sn in split_assignments]
            await bulk_assign_examples_to_splits(session=session, assignments=id_assignments)

    return DatasetExampleAdditionEvent(dataset_id=dataset_id, dataset_version_id=dataset_version_id)


@dataclass(frozen=True)
class DatasetKeys:
    input: frozenset[str]
    output: frozenset[str]
    metadata: frozenset[str]

    def __iter__(self) -> Iterator[str]:
        yield from sorted(set(chain(self.input, self.output, self.metadata)))

    def check_differences(self, column_headers_set: frozenset[str]) -> None:
        for category, keys in (
            ("input", self.input),
            ("output", self.output),
            ("metadata", self.metadata),
        ):
            if diff := keys.difference(column_headers_set):
                raise ValueError(f"{category} keys not found in table column headers: {diff}")
