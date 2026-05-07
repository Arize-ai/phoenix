from base64 import b64encode

import pytest
from strawberry.relay import GlobalID

from phoenix.server.api.types.node import (
    from_global_id,
    from_global_id_with_expected_type,
    is_composite_global_id,
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


# Regression tests for https://github.com/Arize-ai/phoenix/issues/12908 -- bare
# project names (e.g. "default") reach the `node` resolver via
# /projects/<name>/* URLs and previously raised `binascii.Error: Incorrect
# padding` from inside `is_composite_global_id`.


def test_is_composite_global_id_returns_false_for_non_base64_input() -> None:
    """Literal project names like "default" must not raise."""
    assert is_composite_global_id("default") is False


@pytest.mark.parametrize(
    "node_id",
    [
        "default",  # invalid base64 alphabet char ("u") + wrong padding
        "my-project-name",
        "abc",  # 3 chars -- wrong base64 length
        "",  # empty
        "===",  # only padding
        "not!base64",  # invalid base64 char
    ],
)
def test_is_composite_global_id_handles_invalid_base64(node_id: str) -> None:
    """All invalid base64 inputs return False instead of raising."""
    assert is_composite_global_id(node_id) is False


def test_is_composite_global_id_returns_false_for_simple_global_id() -> None:
    """Standard non-composite ids (b64 of "Project:1") are not composite."""
    simple = b64encode(b"Project:1").decode()
    assert is_composite_global_id(simple) is False


def test_is_composite_global_id_returns_true_for_composite_id() -> None:
    """A composite id has more than one ':' separator after base64 decode."""
    composite = b64encode(b"ExperimentRepeatedRunGroup:1:2").decode()
    assert is_composite_global_id(composite) is True


def test_is_composite_global_id_handles_non_utf8_decoded_bytes() -> None:
    """Random base64 that decodes to non-UTF-8 bytes must not raise."""
    # b64encode(b"\xff\xff\xff") -> decodes to non-UTF-8 bytes
    non_utf8 = b64encode(b"\xff\xff\xff").decode()
    assert is_composite_global_id(non_utf8) is False
