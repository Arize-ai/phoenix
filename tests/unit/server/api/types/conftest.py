from collections.abc import Callable
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Optional
from unittest.mock import Mock

import pytest
from sqlalchemy import insert
from strawberry.schema import Schema as StrawberrySchema
from strawberry.types.info import Info

from phoenix.core.model_schema import Model
from phoenix.core.model_schema_adapter import create_model_from_inferences
from phoenix.db import models
from phoenix.inferences.inferences import Inferences
from phoenix.server.api.context import Context
from phoenix.server.api.queries import Query
from phoenix.server.types import DbSessionFactory


@pytest.fixture
def info_mock_factory() -> Callable[[Model], Info[Context, None]]:
    """
    A pytest fixture to inject a primary inferences and an optional reference
    inferences into a mock of a strawberry.types.info.Info object.
    """

    def create_info_mock(model: Model) -> Mock:
        info_mock = Mock(spec=Info)
        info_mock.context = Mock(spec=Context)
        info_mock.context.model = model
        return info_mock

    return create_info_mock


@pytest.fixture
def context_factory() -> Callable[[Inferences, Optional[Inferences]], Context]:
    """
    A pytest fixture to inject a primary inferences and an optional reference
    inferences into an instance of a phoenix.server.api.context.Context object.
    """

    def create_context(
        primary_inferences: Inferences, reference_inferences: Optional[Inferences]
    ) -> Context:
        return Context(
            model=create_model_from_inferences(primary_inferences, reference_inferences),
            export_path=Path(TemporaryDirectory().name),
            # TODO(persistence): add mock for db
            db=None,  # type: ignore[arg-type]
            # TODO(persistence): add mock for data_loaders
            data_loaders=None,  # type: ignore[arg-type]
            cache_for_dataloaders=None,
            span_cost_calculator=None,  # type: ignore[arg-type]
        )

    return create_context


@pytest.fixture
def strawberry_schema() -> StrawberrySchema:
    return StrawberrySchema(Query)


@pytest.fixture
async def interlaced_experiments(db: DbSessionFactory) -> list[int]:
    async with db() as session:
        dataset_ids = list(
            await session.scalars(
                insert(models.Dataset).returning(models.Dataset.id),
                [{"name": f"{i}", "metadata_": {}} for i in range(3)],
            )
        )
        dataset_version_ids = list(
            await session.scalars(
                insert(models.DatasetVersion).returning(models.DatasetVersion.dataset_id),
                [{"dataset_id": dataset_id, "metadata_": {}} for dataset_id in dataset_ids],
            )
        )
        return list(
            await session.scalars(
                insert(models.Experiment).returning(models.Experiment.id),
                [
                    {
                        "dataset_id": dataset_id,
                        "dataset_version_id": dataset_version_ids[i],
                        "name": f"experiment-{i}",
                        "repetitions": 1,
                        "metadata_": {},
                    }
                    for _ in range(4)
                    for i, dataset_id in enumerate(dataset_ids)
                ],
            )
        )
