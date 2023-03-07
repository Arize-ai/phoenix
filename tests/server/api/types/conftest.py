from typing import Callable, Optional
from unittest.mock import Mock

import pytest
from phoenix.core.model import Model
from phoenix.datasets import Dataset
from phoenix.server.api.context import Context
from phoenix.server.api.schema import Query
from strawberry.schema import Schema as StrawberrySchema
from strawberry.types.info import Info


@pytest.fixture
def info_mock_factory() -> Callable[[Dataset, Optional[Dataset]], Info[Context, None]]:
    """
    A pytest fixture to inject a primary dataset and an optional reference
    dataset into a mock of a strawberry.types.info.Info object.
    """

    def create_info_mock(primary_dataset: Dataset, reference_dataset: Optional[Dataset]) -> Mock:
        info_mock = Mock(spec=Info)
        info_mock.context = Mock(spec=Context)
        info_mock.context.model = Mock(spec=Model)
        info_mock.context.model.primary_dataset = primary_dataset
        info_mock.context.model.reference_dataset = reference_dataset
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
            model=Model(primary_dataset=primary_dataset, reference_dataset=reference_dataset),
            loaders=Mock(),
        )

    return create_context


@pytest.fixture
def strawberry_schema() -> StrawberrySchema:
    return StrawberrySchema(Query)
