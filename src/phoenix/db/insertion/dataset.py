import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from itertools import chain
from typing import (
    Any,
    Awaitable,
    Dict,
    FrozenSet,
    Iterable,
    Iterator,
    Mapping,
    Optional,
    Union,
    cast,
)

from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.db.insertion.helpers import DataManipulationEvent

logger = logging.getLogger(__name__)

DatasetId: TypeAlias = int
DatasetVersionId: TypeAlias = int
DatasetExampleId: TypeAlias = int
DatasetExampleRevisionId: TypeAlias = int
SpanRowId: TypeAlias = int


@dataclass(frozen=True)
class ExampleContent:
    input: Dict[str, Any] = field(default_factory=dict)
    output: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)


Examples: TypeAlias = Iterable[ExampleContent]


@dataclass(frozen=True)
class DatasetExampleAdditionEvent(DataManipulationEvent):
    dataset_id: DatasetId


async def insert_dataset(
    session: AsyncSession,
    name: str,
    description: Optional[str] = None,
    metadata: Optional[Mapping[str, Any]] = None,
    created_at: Optional[datetime] = None,
) -> DatasetId:
    id_ = await session.scalar(
        insert(models.Dataset)
        .values(
            name=name,
            description=description,
            metadata_=metadata,
            created_at=created_at,
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
) -> DatasetVersionId:
    id_ = await session.scalar(
        insert(models.DatasetVersion)
        .values(
            dataset_id=dataset_id,
            description=description,
            metadata_=metadata,
            created_at=created_at,
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
            )
        except Exception:
            logger.exception(f"Failed to insert dataset: {name=}")
            raise
    try:
        dataset_version_id = await insert_dataset_version(
            session=session,
            dataset_id=dataset_id,
            created_at=created_at,
        )
    except Exception:
        logger.exception(f"Failed to insert dataset version for {dataset_id=}")
        raise
    for example in (await examples) if isinstance(examples, Awaitable) else examples:
        try:
            dataset_example_id = await insert_dataset_example(
                session=session,
                dataset_id=dataset_id,
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
    return DatasetExampleAdditionEvent(dataset_id=dataset_id)


@dataclass(frozen=True)
class DatasetKeys:
    input: FrozenSet[str]
    output: FrozenSet[str]
    metadata: FrozenSet[str]

    def __iter__(self) -> Iterator[str]:
        yield from sorted(set(chain(self.input, self.output, self.metadata)))

    def check_differences(self, column_headers_set: FrozenSet[str]) -> None:
        for category, keys in (
            ("input", self.input),
            ("output", self.output),
            ("metadata", self.metadata),
        ):
            if diff := keys.difference(column_headers_set):
                raise ValueError(f"{category} keys not found in table column headers: {diff}")
