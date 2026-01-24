import pytest
from strawberry.relay import GlobalID

from phoenix.server.api.types.node import (
    from_global_id,
    from_global_id_with_expected_type,
)


def test_from_global_id_returns_type_name_and_node_id() -> None:
    global_id = GlobalID(type_name="Dimension", node_id=str(1))
    type_name, node_id = from_global_id(global_id)
    assert type_name == "Dimension"
    assert node_id == 1


def test_from_global_id_with_expected_type_returns_node_id() -> None:
    global_id = GlobalID(type_name="Dimension", node_id=str(1))
    node_id = from_global_id_with_expected_type(global_id=global_id, expected_type_name="Dimension")
    assert node_id == 1


def test_from_global_id_with_expected_type_raises_value_error_for_unexpected_type() -> None:
    global_id = GlobalID(type_name="EmbeddingDimension", node_id=str(1))
    with pytest.raises(ValueError):
        from_global_id_with_expected_type(global_id=global_id, expected_type_name="Dimension")
