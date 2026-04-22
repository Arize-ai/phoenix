import logging
from collections.abc import Iterable, Iterator, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from itertools import chain
from typing import Any, Optional, cast

from sqlalchemy import delete, func, insert, select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.relay import GlobalID
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect, get_dataset_example_revisions
from phoenix.db.insertion.helpers import DataManipulationEvent, OnConflict, insert_on_conflict
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.utilities.content_hashing import compute_example_content_hash

# Sentinel hash used for DELETE revisions, whose input/output/metadata are all empty dicts.
# Content is unused for DELETEs (the matcher excludes them), but the column is NOT NULL.
_EMPTY_CONTENT_HASH: bytes = compute_example_content_hash(input={}, output={}, metadata={})

# Batch size for bulk inserts - tuned for good performance across SQLite and PostgreSQL
DEFAULT_BATCH_SIZE = 1000

logger = logging.getLogger(__name__)

DatasetId: TypeAlias = int
DatasetVersionId: TypeAlias = int
DatasetExampleId: TypeAlias = int
DatasetExampleRevisionId: TypeAlias = int
SpanRowId: TypeAlias = int
ExternalID: TypeAlias = str
ContentHash: TypeAlias = bytes
SplitName: TypeAlias = str
DatasetSplitId: TypeAlias = int
SplitAssignment: TypeAlias = tuple[DatasetExampleId, DatasetSplitId]


@dataclass(frozen=True)
class ExampleContent:
    input: dict[str, Any] = field(default_factory=dict)
    output: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)
    splits: frozenset[SplitName] = field(default_factory=frozenset)
    span_id: Optional[str] = None  # OTEL span ID for linking back to traces
    external_id: Optional[str] = None  # External identifier for upsert deduplication


Examples: TypeAlias = Iterable[ExampleContent]


@dataclass(frozen=True)
class ExampleWithHash:
    content: ExampleContent
    content_hash: ContentHash


@dataclass(frozen=True)
class ExampleWithExternalID:
    content: ExampleContent
    example_id: DatasetExampleId
    content_hash: ContentHash


@dataclass(frozen=True)
class ExistingExampleInfo:
    example_id: DatasetExampleId
    content_hash: ContentHash


@dataclass(frozen=True)
class DatasetExampleAdditionEvent(DataManipulationEvent):
    dataset_id: DatasetId
    dataset_version_id: DatasetVersionId
    new_version_created: bool
    num_created_examples: int
    num_patched_examples: int
    num_deleted_examples: int


class InvalidDatasetExampleIDError(ValueError):
    """Raised when example_ids that look like DatasetExample node IDs
    do not match any existing examples."""


class DatasetNameConflictError(ValueError):
    """Raised when a strict-create upload targets an already-used dataset name."""


class RevisionKind(Enum):
    CREATE = "CREATE"
    PATCH = "PATCH"
    DELETE = "DELETE"

    @classmethod
    def _missing_(cls, v: Any) -> "RevisionKind":
        if isinstance(v, str) and v and v.isascii() and not v.isupper():
            return cls(v.upper())
        raise ValueError(f"Invalid revision kind: {v}")


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


async def insert_dataset_example_revision(
    session: AsyncSession,
    dataset_version_id: DatasetVersionId,
    dataset_example_id: DatasetExampleId,
    input: dict[str, Any],
    output: dict[str, Any],
    metadata: dict[str, Any],
    content_hash: bytes,
    revision_kind: RevisionKind = RevisionKind.CREATE,
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
    examples: Sequence[ExampleWithHash],
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
        examples: List of examples with pre-computed content hashes
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
                "input": example.content.input,
                "output": example.content.output,
                "metadata_": example.content.metadata,
                "content_hash": example.content_hash,
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
    assignments: list[SplitAssignment],
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

    @classmethod
    def _missing_(cls, v: Any) -> "DatasetAction":
        if isinstance(v, str) and v and v.isascii() and not v.islower():
            return cls(v.lower())
        raise ValueError(f"Invalid dateset action: {v}")


async def _get_external_ids_and_content_hashes_for_most_recent_version(
    session: AsyncSession,
    dataset_id: DatasetId,
) -> list[tuple[DatasetExampleId, ExternalID, ContentHash]]:
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
        ).join(
            models.DatasetExample, models.DatasetExample.id == revisions_subq.c.dataset_example_id
        )
    )

    return [(row.dataset_example_id, row.external_id, row.content_hash) for row in result]


async def add_dataset_examples(
    session: AsyncSession,
    name: str,
    examples: Sequence[ExampleWithHash],
    description: Optional[str] = None,
    metadata: Optional[Mapping[str, Any]] = None,
    action: DatasetAction = DatasetAction.CREATE,
    user_id: Optional[int] = None,
    splits_provided: bool = True,
    strict_create: bool = False,
) -> DatasetExampleAdditionEvent:
    created_at = datetime.now(timezone.utc)

    dataset_id: Optional[DatasetId] = await session.scalar(
        select(models.Dataset.id).where(models.Dataset.name == name)
    )
    if dataset_id is None:
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
    elif strict_create and action is DatasetAction.CREATE:
        raise DatasetNameConflictError(f'A dataset named "{name}" already exists.')

    return await _upsert_dataset_examples(
        session=session,
        dataset_id=dataset_id,
        examples=examples,
        user_id=user_id,
        created_at=created_at,
        splits_provided=splits_provided,
        action=action,
    )


@dataclass(frozen=True)
class UpsertDiff:
    """Result of diffing incoming examples against the previous dataset version."""

    create_examples: list[ExampleWithHash]
    patch_examples: list[ExampleWithExternalID]
    delete_example_ids: list[DatasetExampleId]
    unchanged_examples: list[ExampleWithExternalID]

    @property
    def has_changes(self) -> bool:
        return bool(self.patch_examples or self.create_examples or self.delete_example_ids)


def _get_dataset_example_node_id(s: str) -> Optional[DatasetExampleId]:
    """
    Decode a string as a DatasetExample GlobalID (base64-encoded 'DatasetExample:{id}').

    Returns the numeric DB ID if successful, None otherwise.
    """

    try:
        return from_global_id_with_expected_type(GlobalID.from_id(s), "DatasetExample")
    except Exception:
        return None


class _ExampleMatcher:
    """Indexes previous examples and matches incoming examples against them.

    An incoming external_id is treated as an opt-in to identity matching: when it
    is provided, the matcher only looks for a node_id or external_id match and
    never falls back to content_hash. When the incoming example has no
    external_id, the matcher uses content_hash to pair it with a previous
    example (for dedup of ID-less uploads such as re-uploaded CSVs).

    Priority:
      - If external_id is provided:  node_id match > external_id match > no match
      - If external_id is absent:    content_hash match > no match
    """

    def __init__(self, previous: list[tuple[DatasetExampleId, ExternalID, ContentHash]]) -> None:
        self._example_info_by_external_id: dict[ExternalID, ExistingExampleInfo] = {}
        self._example_info_by_db_id: dict[DatasetExampleId, ExistingExampleInfo] = {}
        self._example_ids_by_content_hash: dict[ContentHash, list[DatasetExampleId]] = {}
        for example_id, external_id, content_hash in previous:
            info = ExistingExampleInfo(example_id, content_hash)
            self._example_info_by_db_id[example_id] = info
            if external_id is not None:
                self._example_info_by_external_id[external_id] = info
            self._example_ids_by_content_hash.setdefault(content_hash, []).append(example_id)
        self._already_matched: set[DatasetExampleId] = set()

    def find_match(self, incoming: ExampleWithHash) -> Optional[ExistingExampleInfo]:
        external_id = incoming.content.external_id
        if external_id is not None:
            db_id = _get_dataset_example_node_id(external_id)
            if db_id is not None:
                return self._example_info_by_db_id.get(db_id)
            if external_id in self._example_info_by_external_id:
                return self._example_info_by_external_id[external_id]
            return None
        for candidate_id in self._example_ids_by_content_hash.get(incoming.content_hash, []):
            if candidate_id not in self._already_matched:
                return ExistingExampleInfo(candidate_id, incoming.content_hash)
        return None


def _diff_examples(
    *,
    incoming_examples: list[ExampleWithHash],
    previous: list[tuple[DatasetExampleId, ExternalID, ContentHash]],
    skip_deletes: bool = False,
) -> UpsertDiff:
    """Diff incoming examples against the previous version to classify as CREATE, PATCH, or DELETE.

    Matching rules (applied per incoming example, in order):
      1. If the incoming example has an external_id, pair only by that external_id
         (or node_id if it decodes as a DatasetExample GlobalID). An incoming
         external_id that does not match any previous example is treated as a new
         example, even if another previous example happens to share its content_hash.
      2. If the incoming example has no external_id, pair with the first unmatched
         previous example sharing the same content_hash.
      3. If no match is found, the incoming example is a CREATE.

    After matching:
      - Matched + same content_hash  → unchanged (carried forward implicitly, no revision needed)
      - Matched + different hash     → PATCH
      - Unmatched incoming           → CREATE
      - Unmatched previous           → DELETE (skipped when skip_deletes=True)
    """
    matcher = _ExampleMatcher(previous)
    examples_to_create: list[ExampleWithHash] = []
    examples_to_patch: list[ExampleWithExternalID] = []
    examples_unchanged: list[ExampleWithExternalID] = []

    for incoming in incoming_examples:
        match = matcher.find_match(incoming)
        if match is None:
            examples_to_create.append(incoming)
            continue
        matcher._already_matched.add(match.example_id)
        if incoming.content_hash != match.content_hash:
            examples_to_patch.append(
                ExampleWithExternalID(
                    content=incoming.content,
                    example_id=match.example_id,
                    content_hash=incoming.content_hash,
                )
            )
        else:
            examples_unchanged.append(
                ExampleWithExternalID(
                    content=incoming.content,
                    example_id=match.example_id,
                    content_hash=incoming.content_hash,
                )
            )

    if skip_deletes:
        delete_ids: list[DatasetExampleId] = []
    else:
        all_previous_ids = {example_id for example_id, _, _ in previous}
        delete_ids = [
            example_id
            for example_id in all_previous_ids
            if example_id not in matcher._already_matched
        ]

    return UpsertDiff(
        create_examples=examples_to_create,
        patch_examples=examples_to_patch,
        delete_example_ids=delete_ids,
        unchanged_examples=examples_unchanged,
    )


async def _get_existing_example_ids(
    session: AsyncSession,
    dataset_id: DatasetId,
    external_ids: list[ExternalID],
) -> dict[ExternalID, DatasetExampleId]:
    if not external_ids:
        return {}
    result = await session.execute(
        select(models.DatasetExample.external_id, models.DatasetExample.id)
        .where(models.DatasetExample.dataset_id == dataset_id)
        .where(models.DatasetExample.external_id.in_(external_ids))
    )
    return {
        external_id: example_id
        for external_id, example_id in result.all()
        if external_id is not None
    }


async def _rebuild_dataset_splits(
    session: AsyncSession,
    dataset_id: DatasetId,
    diff: UpsertDiff,
    created_examples: list[ExampleWithExternalID],
    splits_provided: bool = True,
    user_id: Optional[int] = None,
) -> None:
    """Collect split assignments from unchanged, patched, and created examples,
    then delete all existing split assignments for the dataset and reassign.

    When *splits_provided* is False the caller did not supply a ``splits``
    parameter at all, so existing split assignments are preserved for surviving
    examples and only deleted examples lose their assignments.
    """

    if not splits_provided:
        if diff.delete_example_ids:
            await session.execute(
                delete(models.DatasetSplitDatasetExample).where(
                    models.DatasetSplitDatasetExample.dataset_example_id.in_(
                        diff.delete_example_ids
                    )
                )
            )
        return

    await session.execute(
        delete(models.DatasetSplitDatasetExample).where(
            models.DatasetSplitDatasetExample.dataset_example_id.in_(
                select(models.DatasetExample.id).where(
                    models.DatasetExample.dataset_id == dataset_id
                )
            )
        )
    )
    example_splits: list[tuple[DatasetExampleId, frozenset[SplitName]]] = [
        (example.example_id, example.content.splits)
        for example in diff.unchanged_examples + diff.patch_examples + created_examples
    ]
    example_id_split_name_pairs = [
        (example_id, name) for example_id, splits in example_splits for name in splits
    ]
    all_split_names = {name for _, name in example_id_split_name_pairs}
    split_name_to_id = await bulk_create_dataset_splits(
        session=session, split_names=all_split_names, user_id=user_id
    )
    split_assignments = [
        (example_id, split_name_to_id[name]) for example_id, name in example_id_split_name_pairs
    ]
    await bulk_assign_examples_to_splits(session=session, assignments=split_assignments)


async def _update_splits(
    session: AsyncSession,
    examples: list[ExampleWithExternalID],
    splits_provided: bool = True,
    user_id: Optional[int] = None,
) -> None:
    """Update split assignments only for the given examples, leaving other examples untouched.

    Used by the APPEND action so that examples not in the upload keep their splits.
    """
    if not splits_provided or not examples:
        return

    touched_example_ids = [e.example_id for e in examples]

    await session.execute(
        delete(models.DatasetSplitDatasetExample).where(
            models.DatasetSplitDatasetExample.dataset_example_id.in_(touched_example_ids)
        )
    )

    example_id_split_name_pairs = [
        (example.example_id, name) for example in examples for name in example.content.splits
    ]
    if not example_id_split_name_pairs:
        return

    all_split_names = {name for _, name in example_id_split_name_pairs}
    split_name_to_id = await bulk_create_dataset_splits(
        session=session, split_names=all_split_names, user_id=user_id
    )
    split_assignments = [
        (example_id, split_name_to_id[name]) for example_id, name in example_id_split_name_pairs
    ]
    await bulk_assign_examples_to_splits(session=session, assignments=split_assignments)


async def _upsert_dataset_examples(
    session: AsyncSession,
    dataset_id: DatasetId,
    examples: Sequence[ExampleWithHash],
    action: DatasetAction,
    user_id: Optional[int] = None,
    created_at: Optional[datetime] = None,
    splits_provided: bool = True,
) -> DatasetExampleAdditionEvent:
    incoming_examples = list(examples)
    if created_at is None:
        created_at = datetime.now(timezone.utc)

    # Load previous state
    previous = await _get_external_ids_and_content_hashes_for_most_recent_version(
        session, dataset_id
    )

    # Diff incoming vs previous → creates, patches, deletes
    diff = _diff_examples(
        incoming_examples=incoming_examples,
        previous=previous,
        skip_deletes=action is DatasetAction.APPEND,
    )

    # Write revisions if content changed, otherwise reuse latest version
    created_examples: list[ExampleWithExternalID] = []
    if diff.has_changes:
        dataset_version_id = await insert_dataset_version(
            session=session,
            dataset_id=dataset_id,
            created_at=created_at,
            user_id=user_id,
        )

        for revision in diff.patch_examples:
            await insert_dataset_example_revision(
                session=session,
                dataset_version_id=dataset_version_id,
                dataset_example_id=revision.example_id,
                input=revision.content.input,
                output=revision.content.output,
                metadata=revision.content.metadata,
                revision_kind=RevisionKind.PATCH,
                content_hash=revision.content_hash,
                created_at=created_at,
            )

        for example_id in diff.delete_example_ids:
            await insert_dataset_example_revision(
                session=session,
                dataset_version_id=dataset_version_id,
                dataset_example_id=example_id,
                input={},
                output={},
                metadata={},
                revision_kind=RevisionKind.DELETE,
                content_hash=_EMPTY_CONTENT_HASH,
                created_at=created_at,
            )

        if diff.create_examples:
            node_ids_without_example_record: list[str] = []
            for example in diff.create_examples:
                external_id = example.content.external_id
                if external_id is None:
                    continue
                is_node_id_without_example_record = (
                    _get_dataset_example_node_id(external_id) is not None
                )
                if is_node_id_without_example_record:
                    node_ids_without_example_record.append(external_id)
            if node_ids_without_example_record:
                formatted_ids = ", ".join(repr(s) for s in node_ids_without_example_record)
                raise InvalidDatasetExampleIDError(
                    "Example IDs that look like node IDs "
                    "must match existing examples, but the following do not correspond to any "
                    f"existing examples: {formatted_ids}"
                )
            create_external_ids = [
                example.content.external_id
                for example in diff.create_examples
                if example.content.external_id is not None
            ]
            external_id_to_existing_example_id = await _get_existing_example_ids(
                session, dataset_id, create_external_ids
            )
            span_ids_to_resolve = [r.content.span_id for r in diff.create_examples]
            span_id_to_rowid = await resolve_span_ids_to_rowids(session, span_ids_to_resolve)
            for new_revision in diff.create_examples:
                content = new_revision.content
                span_rowid = None
                if content.span_id:
                    span_rowid = span_id_to_rowid.get(content.span_id)

                existing_example_id = (
                    external_id_to_existing_example_id.get(content.external_id)
                    if content.external_id is not None
                    else None
                )
                if existing_example_id is not None:
                    example_id = existing_example_id
                else:
                    example_id = await insert_dataset_example(
                        session=session,
                        dataset_id=dataset_id,
                        span_rowid=span_rowid,
                        external_id=content.external_id,
                        created_at=created_at,
                    )
                await insert_dataset_example_revision(
                    session=session,
                    dataset_version_id=dataset_version_id,
                    dataset_example_id=example_id,
                    input=content.input,
                    output=content.output,
                    metadata=content.metadata,
                    revision_kind=RevisionKind.CREATE,
                    content_hash=new_revision.content_hash,
                    created_at=created_at,
                )
                created_examples.append(
                    ExampleWithExternalID(
                        content=content,
                        example_id=example_id,
                        content_hash=new_revision.content_hash,
                    )
                )
    else:
        latest_version_id = await session.scalar(
            select(models.DatasetVersion.id)
            .where(models.DatasetVersion.dataset_id == dataset_id)
            .order_by(models.DatasetVersion.created_at.desc())
            .limit(1)
        )
        if latest_version_id is not None:
            dataset_version_id = latest_version_id
        else:
            dataset_version_id = await insert_dataset_version(
                session=session,
                dataset_id=dataset_id,
                created_at=created_at,
                user_id=user_id,
            )

    if action is DatasetAction.APPEND:
        touched_examples = diff.unchanged_examples + diff.patch_examples + created_examples
        await _update_splits(
            session=session,
            examples=touched_examples,
            splits_provided=splits_provided,
            user_id=user_id,
        )
    elif action is DatasetAction.CREATE:
        await _rebuild_dataset_splits(
            session=session,
            dataset_id=dataset_id,
            diff=diff,
            created_examples=created_examples,
            splits_provided=splits_provided,
            user_id=user_id,
        )
    else:
        assert_never(action)

    return DatasetExampleAdditionEvent(
        dataset_id=dataset_id,
        dataset_version_id=dataset_version_id,
        new_version_created=diff.has_changes,
        num_created_examples=len(diff.create_examples),
        num_patched_examples=len(diff.patch_examples),
        num_deleted_examples=len(diff.delete_example_ids),
    )


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
