from typing import Callable, Optional
from unittest.mock import Mock

import pytest
from strawberry.types.info import Info

from phoenix.core.model import Model
from phoenix.datasets import Dataset
from phoenix.server.api.context import Context


@pytest.fixture
def info_mock_factory() -> Callable[[Dataset, Optional[Dataset]], Info[Context, None]]:
    def create_info_mock(primary_dataset: Dataset, reference_dataset: Optional[Dataset]) -> Mock:
        info_mock = Mock(spec=Info)
        info_mock.context = Mock(spec=Context)
        info_mock.context.model = Mock(spec=Model)
        info_mock.context.model.primary_dataset = primary_dataset
        info_mock.context.model.reference_dataset = reference_dataset
        return info_mock

    return create_info_mock
