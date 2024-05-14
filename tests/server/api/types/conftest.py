from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Callable, Optional
from unittest.mock import Mock

import pytest
from phoenix.core.model_schema import Model
from phoenix.core.model_schema_adapter import create_model_from_inferences
from phoenix.inferences.inferences import Inferences
from phoenix.server.api.context import Context
from phoenix.server.api.schema import Query
from strawberry.schema import Schema as StrawberrySchema
from strawberry.types.info import Info


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
            request=Mock(),
            response=None,
            model=create_model_from_inferences(primary_inferences, reference_inferences),
            export_path=Path(TemporaryDirectory().name),
            db=None,  # TODO(persistence): add mock for db
            data_loaders=None,  # TODO(persistence): add mock for data_loaders
            cache_for_dataloaders=None,
        )

    return create_context


@pytest.fixture
def strawberry_schema() -> StrawberrySchema:
    return StrawberrySchema(Query)
