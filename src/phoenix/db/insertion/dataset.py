import logging
from collections.abc import Awaitable, Iterable, Iterator, Mapping
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from itertools import chain
from typing import Any, Optional, Union, cast

from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import (
    DataManipulationEvent,
    OnConflict,
    insert_on_conflict,
)

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
    created_at: Optional[datetime] = None,
) -> DatasetExampleId:
    id_ = await session.scalar(
        insert(models.DatasetExample)
        .values(
            dataset_id=dataset_id,
            span_rowid=span_rowid,
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
    records = [
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
