import re

from phoenix.db.insertion.dataset import ExampleContent
from phoenix.utilities.content_hashing import compute_example_content_hash


def test_content_hash_is_key_order_independent() -> None:
    """Two ExampleContent with same values but different key order → same content_hash."""
    ex1 = ExampleContent(input={"a": 1, "b": 2}, output={})
    ex2 = ExampleContent(input={"b": 2, "a": 1}, output={})

    h1 = compute_example_content_hash(input=ex1.input, output=ex1.output, metadata=ex1.metadata)
    h2 = compute_example_content_hash(input=ex2.input, output=ex2.output, metadata=ex2.metadata)
    assert h1 == h2


def test_content_hash_is_deterministic() -> None:
    """Same inputs always produce the same hash."""
    ex = ExampleContent(input={"x": 1}, output={"y": 2}, metadata={"z": 3})
    h1 = compute_example_content_hash(input=ex.input, output=ex.output, metadata=ex.metadata)
    h2 = compute_example_content_hash(input=ex.input, output=ex.output, metadata=ex.metadata)
    assert h1 == h2


def test_content_hash_is_sha256_hex() -> None:
    """Hash is a 64-character lowercase hex string (SHA-256)."""
    ex = ExampleContent(input={"a": 1}, output={})
    h = compute_example_content_hash(input=ex.input, output=ex.output, metadata=ex.metadata)
    assert re.fullmatch(r"[0-9a-f]{64}", h)


def test_content_hash_differs_on_input_change() -> None:
    ex1 = ExampleContent(input={"a": 1}, output={})
    ex2 = ExampleContent(input={"a": 2}, output={})
    h1 = compute_example_content_hash(input=ex1.input, output=ex1.output, metadata=ex1.metadata)
    h2 = compute_example_content_hash(input=ex2.input, output=ex2.output, metadata=ex2.metadata)
    assert h1 != h2


def test_content_hash_differs_on_output_change() -> None:
    ex1 = ExampleContent(input={}, output={"result": "yes"})
    ex2 = ExampleContent(input={}, output={"result": "no"})
    h1 = compute_example_content_hash(input=ex1.input, output=ex1.output, metadata=ex1.metadata)
    h2 = compute_example_content_hash(input=ex2.input, output=ex2.output, metadata=ex2.metadata)
    assert h1 != h2


def test_content_hash_differs_on_metadata_change() -> None:
    ex1 = ExampleContent(input={}, output={}, metadata={"tag": "a"})
    ex2 = ExampleContent(input={}, output={}, metadata={"tag": "b"})
    h1 = compute_example_content_hash(input=ex1.input, output=ex1.output, metadata=ex1.metadata)
    h2 = compute_example_content_hash(input=ex2.input, output=ex2.output, metadata=ex2.metadata)
    assert h1 != h2


def test_content_hash_nested_key_order_independent() -> None:
    """Key order independence applies to nested dicts."""
    ex1 = ExampleContent(input={"nested": {"x": 1, "y": 2}}, output={})
    ex2 = ExampleContent(input={"nested": {"y": 2, "x": 1}}, output={})
    h1 = compute_example_content_hash(input=ex1.input, output=ex1.output, metadata=ex1.metadata)
    h2 = compute_example_content_hash(input=ex2.input, output=ex2.output, metadata=ex2.metadata)
    assert h1 == h2


def test_content_hash_nested_objects_differ_on_value_change() -> None:
    """Changing a value inside a nested object changes the hash."""
    ex1 = ExampleContent(input={"model": {"name": "gpt-4", "temp": 0.5}}, output={})
    ex2 = ExampleContent(input={"model": {"name": "gpt-4", "temp": 0.9}}, output={})
    h1 = compute_example_content_hash(input=ex1.input, output=ex1.output, metadata=ex1.metadata)
    h2 = compute_example_content_hash(input=ex2.input, output=ex2.output, metadata=ex2.metadata)
    assert h1 != h2


def test_content_hash_list_order_matters() -> None:
    """List element order is significant — [1, 2] and [2, 1] are different."""
    ex1 = ExampleContent(input={"items": [1, 2, 3]}, output={})
    ex2 = ExampleContent(input={"items": [3, 2, 1]}, output={})
    h1 = compute_example_content_hash(input=ex1.input, output=ex1.output, metadata=ex1.metadata)
    h2 = compute_example_content_hash(input=ex2.input, output=ex2.output, metadata=ex2.metadata)
    assert h1 != h2


def test_content_hash_list_identical_produces_same_hash() -> None:
    """Identical lists produce the same hash regardless of when they are computed."""
    ex1 = ExampleContent(input={"items": ["a", "b", "c"]}, output={})
    ex2 = ExampleContent(input={"items": ["a", "b", "c"]}, output={})
    h1 = compute_example_content_hash(input=ex1.input, output=ex1.output, metadata=ex1.metadata)
    h2 = compute_example_content_hash(input=ex2.input, output=ex2.output, metadata=ex2.metadata)
    assert h1 == h2
