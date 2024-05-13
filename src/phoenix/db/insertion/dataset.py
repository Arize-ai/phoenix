import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from itertools import chain
from typing import Any, FrozenSet, Iterable, Iterator, Mapping, Optional, Sequence

from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.db.insertion.helpers import DataModificationEvent

logger = logging.getLogger(__name__)

DatasetId: TypeAlias = int
DatasetVersionId: TypeAlias = int
DatasetExampleId: TypeAlias = int
DatasetExampleRevisionId: TypeAlias = int
SpanRowId: TypeAlias = int


@dataclass(frozen=True)
class DatasetCreationEvent(DataModificationEvent):
    dataset_id: DatasetId


async def insert_dataset(
    session: AsyncSession,
    name: str,
    description: Optional[str] = None,
    metadata: Optional[Mapping[str, Any]] = None,
    created_at: Optional[datetime] = None,
) -> Optional[DatasetId]:
    return await session.scalar(
        insert(models.Dataset)
        .values(
            name=name,
            description=description,
            metadata_=metadata or {},
            created_at=created_at,
        )
        .returning(models.Dataset.id)
    )


async def insert_dataset_version(
    session: AsyncSession,
    dataset_id: DatasetId,
    description: Optional[str] = None,
    metadata: Optional[Mapping[str, Any]] = None,
    created_at: Optional[datetime] = None,
) -> Optional[DatasetVersionId]:
    return await session.scalar(
        insert(models.DatasetVersion)
        .values(
            dataset_id=dataset_id,
            description=description,
            metadata_=metadata or {},
            created_at=created_at,
        )
        .returning(models.DatasetVersion.id)
    )


async def insert_dataset_example(
    session: AsyncSession,
    dataset_id: DatasetId,
    span_rowid: Optional[SpanRowId] = None,
    created_at: Optional[datetime] = None,
) -> Optional[DatasetExampleId]:
    return await session.scalar(
        insert(models.DatasetExample)
        .values(
            dataset_id=dataset_id,
            span_rowid=span_rowid,
            created_at=created_at,
        )
        .returning(models.DatasetExample.id)
    )


class RevisionKind(Enum):
    CREATE = "CREATE"
    PATCH = "PATCH"
    DELETE = "DELETE"


async def insert_dataset_example_revision(
    session: AsyncSession,
    dataset_version_id: DatasetVersionId,
    dataset_example_id: DatasetExampleId,
    input: Mapping[str, Any],
    output: Mapping[str, Any],
    metadata: Optional[Mapping[str, Any]] = None,
    revision_kind: RevisionKind = RevisionKind.CREATE,
    created_at: Optional[datetime] = None,
) -> Optional[DatasetExampleRevisionId]:
    return await session.scalar(
        insert(models.DatasetExampleRevisions)
        .values(
            dataset_version_id=dataset_version_id,
            dataset_example_id=dataset_example_id,
            input=input,
            output=output,
            metadata_=metadata or {},
            revision_kind=revision_kind.value,
            created_at=created_at,
        )
        .returning(models.DatasetExampleRevisions.id)
    )


class DatasetTableAction(Enum):
    CREATE = "create"
    APPEND = "append"

    @classmethod
    def _missing_(cls, v: Any) -> Optional["DatasetTableAction"]:
        if isinstance(v, str) and v and v.isascii() and not v.islower():
            return cls(v.lower())
        return None


async def add_dataset_examples(
    session: AsyncSession,
    name: str,
    examples: Iterable[Mapping[str, Any]],
    input_keys: Sequence[str],
    output_keys: Sequence[str],
    metadata_keys: Sequence[str] = (),
    description: Optional[str] = None,
    metadata: Optional[Mapping[str, Any]] = None,
    action: DatasetTableAction = DatasetTableAction.CREATE,
) -> Optional[DatasetCreationEvent]:
    keys = DatasetKeys(frozenset(input_keys), frozenset(output_keys), frozenset(metadata_keys))
    created_at = datetime.now(timezone.utc)
    dataset_id: Optional[DatasetId] = None
    if action is DatasetTableAction.APPEND and name:
        dataset_id = await session.scalar(
            select(models.Dataset.id).where(models.Dataset.name == name)
        )
    if action is DatasetTableAction.CREATE or dataset_id is None:
        try:
            dataset_id = await insert_dataset(
                session=session,
                name=name,
                description=description,
                metadata=metadata,
                created_at=created_at,
            )
        except Exception:
            logger.exception(
                f"Fail to insert dataset: {input_keys=}, {output_keys=}, {metadata_keys=}"
            )
            raise
    assert dataset_id is not None
    try:
        dataset_version_id = await insert_dataset_version(
            session=session,
            dataset_id=dataset_id,
            created_at=created_at,
        )
    except Exception:
        logger.exception(f"Fail to insert dataset version for {dataset_id=}")
        raise
    assert dataset_version_id is not None
    for row in examples:
        try:
            dataset_example_id = await insert_dataset_example(
                session=session,
                dataset_id=dataset_id,
                created_at=created_at,
            )
        except Exception:
            logger.exception(f"Fail to insert dataset example for {dataset_id=}")
            raise
        assert dataset_example_id is not None
        try:
            dataset_example_revision = await insert_dataset_example_revision(
                session=session,
                dataset_version_id=dataset_version_id,
                dataset_example_id=dataset_example_id,
                input={key: row.get(key) for key in keys.input},
                output={key: row.get(key) for key in keys.output},
                metadata={key: row.get(key) for key in keys.metadata},
                created_at=created_at,
            )
        except Exception:
            logger.exception(
                f"Fail to insert dataset example revision for {dataset_version_id=}, "
                f"{dataset_example_id=}"
            )
            raise
        assert dataset_example_revision is not None
    return DatasetCreationEvent(dataset_id=dataset_id)


@dataclass(frozen=True)
class DatasetKeys:
    input: FrozenSet[str]
    output: FrozenSet[str]
    metadata: FrozenSet[str]

    def __iter__(self) -> Iterator[str]:
        return chain(self.input, self.output, self.metadata)

    def __post_init__(self) -> None:
        if overlap := self.input.intersection(self.output):
            raise ValueError(f"input_keys and output_keys have overlap: {overlap}")
        if overlap := self.input.intersection(self.metadata):
            raise ValueError(f"input_keys and metadata_keys have overlap: {overlap}")
        if overlap := self.output.intersection(self.metadata):
            raise ValueError(f"output_keys and metadata_keys have overlap: {overlap}")

    def check_differences(self, column_headers_set: FrozenSet[str]) -> None:
        for category, keys in (
            ("input", self.input),
            ("output", self.output),
            ("metadata", self.metadata),
        ):
            if diff := keys.difference(column_headers_set):
                raise ValueError(f"{category} keys not found in table column headers: {diff}")
