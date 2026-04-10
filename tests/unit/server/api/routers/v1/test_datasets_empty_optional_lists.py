from pathlib import Path
from typing import Any, Mapping, Optional, cast

import pytest


def _load_process_json():
    source_path = Path(__file__).resolve().parents[6] / "src" / "phoenix" / "server" / "api" / "routers" / "v1" / "datasets.py"
    source = source_path.read_text(encoding="utf-8")
    start = source.index("def _process_json(")
    end = source.index("\n\nasync def _process_csv(", start)
    function_source = source[start:end]

    namespace = {
        "Any": Any,
        "Mapping": Mapping,
        "Optional": Optional,
        "cast": cast,
        "Examples": object,
        "Name": str,
        "Description": str,
        "DatasetAction": lambda value: value,
        "_is_all_dict": lambda seq: all(isinstance(item, dict) for item in seq),
    }
    exec(function_source, namespace)
    return namespace["_process_json"]


_process_json = _load_process_json()


@pytest.mark.parametrize("field", ["outputs", "metadata"])
def test_process_json_rejects_explicit_empty_optional_lists(field: str) -> None:
    with pytest.raises(
        ValueError,
        match=rf"{field} should be a list of same length as input containing only dictionary objects",
    ):
        _process_json(
            {
                "name": "dataset",
                "inputs": [{"question": "a"}, {"question": "b"}],
                field: [],
            }
        )
