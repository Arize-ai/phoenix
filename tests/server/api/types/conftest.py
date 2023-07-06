from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Callable, Optional
from unittest.mock import Mock

import pytest
from phoenix.core.model import Model
from phoenix.core.model_schema_adapter import create_model_from_datasets
from phoenix.datasets.dataset import Dataset
from phoenix.server.api.context import Context
from phoenix.server.api.schema import Query
from strawberry.schema import Schema as StrawberrySchema
from strawberry.types.info import Info


@pytest.fixture
def info_mock_factory() -> Callable[[Model], Info[Context, None]]:
    """
    A pytest fixture to inject a primary dataset and an optional reference
    dataset into a mock of a strawberry.types.info.Info object.
    """

    def create_info_mock(model: Model) -> Mock:
        info_mock = Mock(spec=Info)
        info_mock.context = Mock(spec=Context)
        info_mock.context.model = model
        return info_mock

    return create_info_mock


@pytest.fixture
def context_factory() -> Callable[[Dataset, Optional[Dataset]], Context]:
    """
    A pytest fixture to inject a primary dataset and an optional reference
    dataset into an instance of a phoenix.server.api.context.Context object.
    """

    def create_context(primary_dataset: Dataset, reference_dataset: Optional[Dataset]) -> Context:
        return Context(
            request=Mock(),
            response=None,
            model=create_model_from_datasets(primary_dataset, reference_dataset),
            export_path=Path(TemporaryDirectory().name),
        )

    return create_context


@pytest.fixture
def strawberry_schema() -> StrawberrySchema:
    return StrawberrySchema(Query)
