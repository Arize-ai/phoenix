import importlib
import sys
from pathlib import Path
from types import ModuleType
from unittest.mock import AsyncMock, Mock

import pytest

client_root = Path(__file__).resolve().parents[4] / "src" / "phoenix"

phoenix_pkg = ModuleType("phoenix")
phoenix_pkg.__path__ = [str(client_root)]
sys.modules.setdefault("phoenix", phoenix_pkg)

for name, path in {
    "phoenix.client": client_root / "client",
    "phoenix.client.resources": client_root / "client" / "resources",
}.items():
    module = ModuleType(name)
    module.__path__ = [str(path)]
    sys.modules.setdefault(name, module)

datasets_module = importlib.import_module("phoenix.client.resources.datasets")
AsyncDatasets = datasets_module.AsyncDatasets
Datasets = datasets_module.Datasets


@pytest.mark.parametrize("field", ["outputs", "metadata"])
def test_sync_upload_rejects_explicit_empty_optional_lists(field: str) -> None:
    datasets = Datasets(Mock())

    with pytest.raises(ValueError, match=rf"{field} must have same length as inputs"):
        datasets._upload_json_dataset(
            dataset_name="test-dataset",
            inputs=[{"question": "a"}, {"question": "b"}],
            **{field: []},
        )

    datasets._client.post.assert_not_called()


@pytest.mark.parametrize("field", ["outputs", "metadata"])
@pytest.mark.asyncio
async def test_async_upload_rejects_explicit_empty_optional_lists(field: str) -> None:
    datasets = AsyncDatasets(AsyncMock())

    with pytest.raises(ValueError, match=rf"{field} must have same length as inputs"):
        await datasets._upload_json_dataset(
            dataset_name="test-dataset",
            inputs=[{"question": "a"}, {"question": "b"}],
            **{field: []},
        )

    datasets._client.post.assert_not_called()
