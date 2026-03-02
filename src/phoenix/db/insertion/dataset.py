import json
import logging
from collections import Counter, defaultdict
from collections.abc import Awaitable, Iterable, Iterator, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from hashlib import sha256
from itertools import chain
from typing import Any, Optional, Union, cast

from sqlalchemy import func, insert, select
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect, get_dataset_example_revisions
from phoenix.db.insertion.helpers import DataManipulationEvent, OnConflict, insert_on_conflict

logger = logging.getLogger(__name__)

DatasetId: TypeAlias = int
DatasetVersionId: TypeAlias = int
DatasetExampleId: TypeAlias = int
DatasetExampleRevisionId: TypeAlias = int
SpanRowId: TypeAlias = int


@dataclass(frozen=True)
class ExampleContent:
    input: dict[str, Any] = field(default_factory=dict)
    output: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)
    splits: frozenset[str] = field(default_factory=frozenset)  # Set of split names
    span_id: Optional[str] = None  # OTEL span ID for linking back to traces
    content_hash: Optional[str] = None  # precomputed hash for upsert workflows
    external_id: Optional[str] = None  # stable identifier enabling PATCH semantics


Examples: TypeAlias = Iterable[ExampleContent]


@dataclass(frozen=True)
class DatasetExampleAdditionEvent(DataManipulationEvent):
    dataset_id: DatasetId
    dataset_version_id: DatasetVersionId


@dataclass(frozen=True)
class DatasetUpsertSummary:
    added: int = 0
    updated: int = 0
    deleted: int = 0
    unchanged: int = 0


@dataclass(frozen=True)
class DatasetExampleUpsertEvent(DataManipulationEvent):
    dataset_id: DatasetId
    dataset_version_id: DatasetVersionId
    summary: DatasetUpsertSummary
    is_noop: bool


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


async def insert_dataset_example_revision(
    session: AsyncSession,
    dataset_version_id: DatasetVersionId,
    dataset_example_id: DatasetExampleId,
    input: Mapping[str, Any],
    output: Mapping[str, Any],
    metadata: Optional[Mapping[str, Any]] = None,
    content_hash: Optional[str] = None,
    revision_kind: RevisionKind = RevisionKind.CREATE,
    created_at: Optional[datetime] = None,
) -> DatasetExampleRevisionId:
    hash_ = normalize_content_hash(
        content_hash or compute_example_content_hash(input=input, output=output, metadata=metadata)
    )
    id_ = await session.scalar(
        insert(models.DatasetExampleRevision)
        .values(
            dataset_version_id=dataset_version_id,
            dataset_example_id=dataset_example_id,
            input=input,
            output=output,
            metadata_=metadata,
            content_hash=hash_,
            revision_kind=revision_kind.value,
            created_at=created_at,
        )
        .returning(models.DatasetExampleRevision.id)
    )
    return cast(DatasetExampleRevisionId, id_)


async def resolve_span_ids_to_rowids(
    session: AsyncSession,
    span_ids: list[Optional[str]],
) -> dict[str, int]:
    """
    Batch resolve span_id strings to database row IDs.

    Args:
        session: Database session
        span_ids: List of OTEL span ID strings

    Returns:
        Dictionary mapping span_id to Span.id (database row ID)
    """
    # Filter out None and empty strings
    valid_span_ids = [sid for sid in span_ids if sid]
    if not valid_span_ids:
        return {}

    # Query spans table for matching span_ids
    result = await session.execute(
        select(models.Span.span_id, models.Span.id).where(models.Span.span_id.in_(valid_span_ids))
    )

    # Build mapping of span_id (string) to span row ID (int)
    span_id_to_rowid: dict[str, int] = {}
    for span_id, row_id in result.all():
        span_id_to_rowid[span_id] = row_id

    # Log warnings for span IDs that couldn't be resolved
    missing_span_ids = set(valid_span_ids) - set(span_id_to_rowid.keys())
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
) -> None:
    """
    Bulk assign examples to splits.
    assignments is a list of (dataset_example_id, dataset_split_id) tuples.
    """
    if not assignments:
        return

    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from sqlalchemy.dialects.sqlite import insert as sqlite_insert
    from typing_extensions import assert_never

    dialect = SupportedSQLDialect(session.bind.dialect.name)
    records = [
        {
            "dataset_example_id": example_id,
            "dataset_split_id": split_id,
        }
        for example_id, split_id in assignments
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


async def add_dataset_examples(
    session: AsyncSession,
    name: str,
    examples: Union[Examples, Awaitable[Examples]],
    description: Optional[str] = None,
    metadata: Optional[Mapping[str, Any]] = None,
    action: DatasetAction = DatasetAction.CREATE,
    user_id: Optional[int] = None,
) -> Optional[DatasetExampleAdditionEvent]:
    created_at = datetime.now(timezone.utc)
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
    examples_list = list((await examples) if isinstance(examples, Awaitable) else examples)

    # Batch resolve span IDs to row IDs
    span_ids_to_resolve = [ex.span_id for ex in examples_list]
    span_id_to_rowid = await resolve_span_ids_to_rowids(session, span_ids_to_resolve)

    # Process examples and collect split assignments (by name, resolved to IDs after iteration)
    split_assignments: list[tuple[DatasetExampleId, str]] = []
    for example in examples_list:
        # Get span row ID if available
        span_rowid = None
        if example.span_id:
            span_rowid = span_id_to_rowid.get(example.span_id)

        try:
            dataset_example_id = await insert_dataset_example(
                session=session,
                dataset_id=dataset_id,
                span_rowid=span_rowid,
                created_at=created_at,
            )
        except Exception:
            logger.exception(f"Failed to insert dataset example for {dataset_id=}")
            raise
        try:
            await insert_dataset_example_revision(
                session=session,
                dataset_version_id=dataset_version_id,
                dataset_example_id=dataset_example_id,
                input=example.input,
                output=example.output,
                metadata=example.metadata,
                created_at=created_at,
            )
        except Exception:
            logger.exception(
                f"Failed to insert dataset example revision for {dataset_version_id=}, "
                f"{dataset_example_id=}"
            )
            raise

        # Collect split assignments by name for bulk insert later
        for split_name in example.splits:
            split_assignments.append((dataset_example_id, split_name))

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


def normalize_content_hash(content_hash: str) -> str:
    normalized_hash = content_hash.strip().lower()
    if len(normalized_hash) != 64 or not all(c in "0123456789abcdef" for c in normalized_hash):
        raise ValueError("content_hash must be a 64-character lowercase hexadecimal SHA-256 string")
    return normalized_hash


def compute_example_content_hash(
    *,
    input: Mapping[str, Any],
    output: Mapping[str, Any],
    metadata: Optional[Mapping[str, Any]] = None,
) -> str:
    # Keep canonical JSON key ordering deterministic for hash generation.
    canonical_payload = json.dumps(
        {
            "input": input,
            "output": output,
            "metadata": metadata or {},
        },
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    )
    return sha256(canonical_payload.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class DatasetHashDiff:
    to_create_by_hash: Counter[str]
    to_delete_by_hash: Counter[str]
    summary: DatasetUpsertSummary

    @property
    def has_changes(self) -> bool:
        return bool(self.to_create_by_hash or self.to_delete_by_hash)


def classify_dataset_hash_diff(
    *,
    existing_hashes: Sequence[str],
    incoming_hashes: Sequence[str],
) -> DatasetHashDiff:
    existing_counts = Counter(existing_hashes)
    incoming_counts = Counter(incoming_hashes)

    unchanged = 0
    to_create_by_hash: Counter[str] = Counter()
    to_delete_by_hash: Counter[str] = Counter()
    for hash_ in existing_counts.keys() | incoming_counts.keys():
        unchanged_count = min(existing_counts[hash_], incoming_counts[hash_])
        unchanged += unchanged_count
        if create_count := incoming_counts[hash_] - unchanged_count:
            to_create_by_hash[hash_] = create_count
        if delete_count := existing_counts[hash_] - unchanged_count:
            to_delete_by_hash[hash_] = delete_count

    create_total = sum(to_create_by_hash.values())
    delete_total = sum(to_delete_by_hash.values())
    updated = min(create_total, delete_total)
    summary = DatasetUpsertSummary(
        added=create_total - updated,
        updated=updated,
        deleted=delete_total - updated,
        unchanged=unchanged,
    )
    return DatasetHashDiff(
        to_create_by_hash=to_create_by_hash,
        to_delete_by_hash=to_delete_by_hash,
        summary=summary,
    )


async def upsert_dataset_examples_by_hash(
    session: AsyncSession,
    *,
    dataset_id: DatasetId,
    examples: Union[Examples, Awaitable[Examples]],
    description: Optional[str] = None,
    metadata: Optional[Mapping[str, Any]] = None,
    user_id: Optional[int] = None,
) -> DatasetExampleUpsertEvent:
    created_at = datetime.now(timezone.utc)
    examples_list = list((await examples) if isinstance(examples, Awaitable) else examples)

    incoming_examples_by_hash: defaultdict[str, list[ExampleContent]] = defaultdict(list)
    for example in examples_list:
        hash_ = normalize_content_hash(
            example.content_hash
            or compute_example_content_hash(
                input=example.input,
                output=example.output,
                metadata=example.metadata,
            )
        )
        incoming_examples_by_hash[hash_].append(example)

    latest_dataset_version_id = await session.scalar(
        select(func.max(models.DatasetVersion.id)).where(
            models.DatasetVersion.dataset_id == dataset_id
        )
    )

    existing_revisions_by_hash: defaultdict[str, list[models.DatasetExampleRevision]] = defaultdict(
        list
    )
    existing_hashes: list[str] = []
    if latest_dataset_version_id is not None:
        active_revisions = (
            await session.scalars(
                get_dataset_example_revisions(latest_dataset_version_id, dataset_id=dataset_id)
            )
        ).all()
        for revision in active_revisions:
            hash_ = normalize_content_hash(
                revision.content_hash
                or compute_example_content_hash(
                    input=revision.input,
                    output=revision.output,
                    metadata=revision.metadata_,
                )
            )
            existing_hashes.append(hash_)
            existing_revisions_by_hash[hash_].append(revision)
        for revision_group in existing_revisions_by_hash.values():
            revision_group.sort(key=lambda revision: revision.dataset_example_id)

    incoming_hashes = list(
        chain.from_iterable(([h] * len(v) for h, v in incoming_examples_by_hash.items()))
    )
    diff = classify_dataset_hash_diff(
        existing_hashes=existing_hashes, incoming_hashes=incoming_hashes
    )

    if latest_dataset_version_id is not None and not diff.has_changes:
        return DatasetExampleUpsertEvent(
            dataset_id=dataset_id,
            dataset_version_id=latest_dataset_version_id,
            summary=diff.summary,
            is_noop=True,
        )

    dataset_version_id = await insert_dataset_version(
        session=session,
        dataset_id=dataset_id,
        description=description,
        metadata=metadata,
        created_at=created_at,
        user_id=user_id,
    )

    delete_revision_records: list[dict[str, Any]] = []
    for hash_, delete_count in diff.to_delete_by_hash.items():
        existing_revisions = existing_revisions_by_hash[hash_]
        if len(existing_revisions) < delete_count:
            raise ValueError(
                f"Requested deletion count for {hash_} exceeds active revision count: "
                f"{delete_count} > {len(existing_revisions)}"
            )
        for revision in existing_revisions[:delete_count]:
            delete_revision_records.append(
                {
                    models.DatasetExampleRevision.dataset_example_id.key: (
                        revision.dataset_example_id
                    ),
                    models.DatasetExampleRevision.dataset_version_id.key: dataset_version_id,
                    models.DatasetExampleRevision.input.key: revision.input,
                    models.DatasetExampleRevision.output.key: revision.output,
                    models.DatasetExampleRevision.metadata_.key: revision.metadata_,
                    models.DatasetExampleRevision.content_hash.key: hash_,
                    models.DatasetExampleRevision.revision_kind.key: RevisionKind.DELETE.value,
                    models.DatasetExampleRevision.created_at.key: created_at,
                }
            )
    if delete_revision_records:
        await session.execute(insert(models.DatasetExampleRevision), delete_revision_records)

    split_assignments: list[tuple[DatasetExampleId, str]] = []
    to_create_examples: list[tuple[str, ExampleContent]] = []
    for hash_, create_count in diff.to_create_by_hash.items():
        incoming_group = incoming_examples_by_hash[hash_]
        if len(incoming_group) < create_count:
            raise ValueError(
                f"Requested create count for {hash_} exceeds incoming examples: "
                f"{create_count} > {len(incoming_group)}"
            )
        to_create_examples.extend((hash_, example) for example in incoming_group[:create_count])

    span_ids_to_resolve = [example.span_id for _, example in to_create_examples]
    span_id_to_rowid = await resolve_span_ids_to_rowids(session, span_ids_to_resolve)

    for hash_, example in to_create_examples:
        span_rowid = span_id_to_rowid.get(example.span_id) if example.span_id else None
        dataset_example_id = await insert_dataset_example(
            session=session,
            dataset_id=dataset_id,
            span_rowid=span_rowid,
            created_at=created_at,
        )
        await insert_dataset_example_revision(
            session=session,
            dataset_version_id=dataset_version_id,
            dataset_example_id=dataset_example_id,
            input=example.input,
            output=example.output,
            metadata=example.metadata,
            content_hash=hash_,
            revision_kind=RevisionKind.CREATE,
            created_at=created_at,
        )
        for split_name in example.splits:
            split_assignments.append((dataset_example_id, split_name))

    if split_assignments:
        split_name_to_id = await bulk_create_dataset_splits(
            session=session,
            split_names={name for _, name in split_assignments},
            user_id=user_id,
        )
        await bulk_assign_examples_to_splits(
            session=session,
            assignments=[
                (example_id, split_name_to_id[split_name])
                for example_id, split_name in split_assignments
            ],
        )

    return DatasetExampleUpsertEvent(
        dataset_id=dataset_id,
        dataset_version_id=dataset_version_id,
        summary=diff.summary,
        is_noop=False,
    )


async def upsert_dataset_examples_by_external_id(
    session: AsyncSession,
    *,
    dataset_id: DatasetId,
    examples: Union[Examples, Awaitable[Examples]],
    description: Optional[str] = None,
    metadata: Optional[Mapping[str, Any]] = None,
    user_id: Optional[int] = None,
) -> DatasetExampleUpsertEvent:
    """
    Upsert dataset examples using external_id as the stable identity key.

    Semantics:
    - Same external_id, same content hash → unchanged (no new revision)
    - Same external_id, different content hash → PATCH revision
    - New external_id → new DatasetExample + CREATE revision
    - Existing external_id absent from incoming → DELETE revision

    Only considers existing dataset_examples that have a non-null external_id.
    Examples without external_id in the existing dataset are left untouched.
    """
    created_at = datetime.now(timezone.utc)
    examples_list = list((await examples) if isinstance(examples, Awaitable) else examples)

    # Build incoming lookup by external_id, computing content hash for each.
    incoming_by_external_id: dict[str, tuple[ExampleContent, str]] = {}
    for example in examples_list:
        if not example.external_id:
            raise ValueError(
                "All examples must have a non-empty external_id when using external_id upsert"
            )
        if example.external_id in incoming_by_external_id:
            raise ValueError(f"Duplicate external_id in incoming examples: {example.external_id!r}")
        hash_ = normalize_content_hash(
            example.content_hash
            or compute_example_content_hash(
                input=example.input,
                output=example.output,
                metadata=example.metadata,
            )
        )
        incoming_by_external_id[example.external_id] = (example, hash_)

    # Find the latest dataset version.
    latest_dataset_version_id = await session.scalar(
        select(func.max(models.DatasetVersion.id)).where(
            models.DatasetVersion.dataset_id == dataset_id
        )
    )

    # Load existing live revisions that belong to examples with external_ids.
    # existing_by_external_id: external_id -> (dataset_example_id, content_hash, revision)
    existing_by_external_id: dict[
        str, tuple[DatasetExampleId, str, models.DatasetExampleRevision]
    ] = {}
    if latest_dataset_version_id is not None:
        active_revisions = (
            await session.scalars(
                get_dataset_example_revisions(latest_dataset_version_id, dataset_id=dataset_id)
            )
        ).all()

        if active_revisions:
            example_ids = [rev.dataset_example_id for rev in active_revisions]
            example_rows = (
                await session.execute(
                    select(models.DatasetExample.id, models.DatasetExample.external_id).where(
                        models.DatasetExample.id.in_(example_ids)
                    )
                )
            ).all()
            example_id_to_external_id: dict[int, Optional[str]] = {
                row.id: row.external_id for row in example_rows
            }

            for revision in active_revisions:
                ext_id = example_id_to_external_id.get(revision.dataset_example_id)
                if not ext_id:
                    continue  # skip examples that have no external_id
                existing_hash = normalize_content_hash(
                    revision.content_hash
                    or compute_example_content_hash(
                        input=revision.input,
                        output=revision.output,
                        metadata=revision.metadata_,
                    )
                )
                existing_by_external_id[ext_id] = (
                    revision.dataset_example_id,
                    existing_hash,
                    revision,
                )

    # Classify changes.
    added = 0
    updated = 0
    deleted = 0
    unchanged = 0

    to_patch: list[tuple[DatasetExampleId, ExampleContent, str]] = []
    to_create: list[tuple[ExampleContent, str]] = []
    to_delete: list[tuple[DatasetExampleId, models.DatasetExampleRevision]] = []

    for ext_id, (example, new_hash) in incoming_by_external_id.items():
        if ext_id in existing_by_external_id:
            existing_example_id, existing_hash, _ = existing_by_external_id[ext_id]
            if new_hash == existing_hash:
                unchanged += 1
            else:
                to_patch.append((existing_example_id, example, new_hash))
                updated += 1
        else:
            to_create.append((example, new_hash))
            added += 1

    for ext_id, (example_id, _, revision) in existing_by_external_id.items():
        if ext_id not in incoming_by_external_id:
            to_delete.append((example_id, revision))
            deleted += 1

    summary = DatasetUpsertSummary(
        added=added, updated=updated, deleted=deleted, unchanged=unchanged
    )
    has_changes = bool(to_patch or to_create or to_delete)

    if latest_dataset_version_id is not None and not has_changes:
        return DatasetExampleUpsertEvent(
            dataset_id=dataset_id,
            dataset_version_id=latest_dataset_version_id,
            summary=summary,
            is_noop=True,
        )

    dataset_version_id = await insert_dataset_version(
        session=session,
        dataset_id=dataset_id,
        description=description,
        metadata=metadata,
        created_at=created_at,
        user_id=user_id,
    )

    # Insert DELETE revisions.
    delete_revision_records: list[dict[str, Any]] = []
    for example_id, revision in to_delete:
        existing_hash = normalize_content_hash(
            revision.content_hash
            or compute_example_content_hash(
                input=revision.input,
                output=revision.output,
                metadata=revision.metadata_,
            )
        )
        delete_revision_records.append(
            {
                models.DatasetExampleRevision.dataset_example_id.key: example_id,
                models.DatasetExampleRevision.dataset_version_id.key: dataset_version_id,
                models.DatasetExampleRevision.input.key: revision.input,
                models.DatasetExampleRevision.output.key: revision.output,
                models.DatasetExampleRevision.metadata_.key: revision.metadata_,
                models.DatasetExampleRevision.content_hash.key: existing_hash,
                models.DatasetExampleRevision.revision_kind.key: RevisionKind.DELETE.value,
                models.DatasetExampleRevision.created_at.key: created_at,
            }
        )
    if delete_revision_records:
        await session.execute(insert(models.DatasetExampleRevision), delete_revision_records)

    # Insert PATCH revisions for updated examples.
    for example_id, example, new_hash in to_patch:
        await insert_dataset_example_revision(
            session=session,
            dataset_version_id=dataset_version_id,
            dataset_example_id=example_id,
            input=example.input,
            output=example.output,
            metadata=example.metadata,
            content_hash=new_hash,
            revision_kind=RevisionKind.PATCH,
            created_at=created_at,
        )

    # Insert CREATE revisions for new examples.
    split_assignments: list[tuple[DatasetExampleId, str]] = []
    span_ids_to_resolve = [example.span_id for example, _ in to_create]
    span_id_to_rowid = await resolve_span_ids_to_rowids(session, span_ids_to_resolve)

    for example, new_hash in to_create:
        span_rowid = span_id_to_rowid.get(example.span_id) if example.span_id else None
        dataset_example_id = await insert_dataset_example(
            session=session,
            dataset_id=dataset_id,
            span_rowid=span_rowid,
            external_id=example.external_id,
            created_at=created_at,
        )
        await insert_dataset_example_revision(
            session=session,
            dataset_version_id=dataset_version_id,
            dataset_example_id=dataset_example_id,
            input=example.input,
            output=example.output,
            metadata=example.metadata,
            content_hash=new_hash,
            revision_kind=RevisionKind.CREATE,
            created_at=created_at,
        )
        for split_name in example.splits:
            split_assignments.append((dataset_example_id, split_name))

    if split_assignments:
        split_name_to_id = await bulk_create_dataset_splits(
            session=session,
            split_names={name for _, name in split_assignments},
            user_id=user_id,
        )
        await bulk_assign_examples_to_splits(
            session=session,
            assignments=[
                (example_id, split_name_to_id[split_name])
                for example_id, split_name in split_assignments
            ],
        )

    return DatasetExampleUpsertEvent(
        dataset_id=dataset_id,
        dataset_version_id=dataset_version_id,
        summary=summary,
        is_noop=False,
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
