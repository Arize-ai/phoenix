import base64

import pytest

from phoenix.client.utils.id_handling import is_node_id


def encode(value: str) -> str:
    return base64.b64encode(value.encode()).decode()


def test_is_node_id_accepts_matching_type_and_numeric_id() -> None:
    assert is_node_id(encode("Dataset:123"), "Dataset") is True
    assert is_node_id(encode("Project:0"), "Project") is True


@pytest.mark.parametrize(
    ("value", "node_type"),
    [
        ("dataset-name", "Dataset"),
        (encode("Dataset:not-an-int"), "Dataset"),
        (encode("Dataset:"), "Dataset"),
        (encode("Dataset:123:extra"), "Dataset"),
        (encode("Project:123"), "Dataset"),
    ],
)
def test_is_node_id_rejects_non_node_ids(value: str, node_type: str) -> None:
    assert is_node_id(value, node_type) is False
