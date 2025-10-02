from collections.abc import Mapping
from datetime import datetime

import pytest

from phoenix.client.__generated__ import v1
from phoenix.client.resources.experiments.types import ExampleProxy


@pytest.fixture
def sample_dataset_example() -> v1.DatasetExample:
    """Create a sample dataset example for testing."""
    return v1.DatasetExample(
        id="test-example-123",
        updated_at="2024-01-15T10:30:00Z",
        input={"question": "What is the capital of France?", "context": "Geography"},
        output={"answer": "Paris", "confidence": 0.95},
        metadata={"source": "test", "category": "geography"},
    )


class TestExampleProxyMapping:
    """Test suite for ExampleProxy Mapping interface implementation."""

    def test_implements_mapping_interface(self, sample_dataset_example: v1.DatasetExample) -> None:
        """Test that ExampleProxy properly implements Mapping interface."""
        proxy = ExampleProxy(sample_dataset_example)
        assert isinstance(proxy, Mapping)

    def test_getitem_access(self, sample_dataset_example: v1.DatasetExample) -> None:
        """Test dictionary-style access using square brackets."""
        proxy = ExampleProxy(sample_dataset_example)

        assert proxy["id"] == "test-example-123"
        assert proxy["input"] == {
            "question": "What is the capital of France?",
            "context": "Geography",
        }
        assert proxy["output"] == {"answer": "Paris", "confidence": 0.95}
        assert proxy["metadata"] == {"source": "test", "category": "geography"}
        assert proxy["updated_at"] == "2024-01-15T10:30:00Z"

    def test_iteration(self, sample_dataset_example: v1.DatasetExample) -> None:
        """Test iteration over proxy keys."""
        proxy = ExampleProxy(sample_dataset_example)

        keys = list(proxy)
        expected_keys = ["id", "input", "output", "metadata", "updated_at"]
        assert set(keys) == set(expected_keys)

    def test_length(self, sample_dataset_example: v1.DatasetExample) -> None:
        """Test len() function on proxy."""
        proxy = ExampleProxy(sample_dataset_example)
        assert len(proxy) == 5  # id, input, output, metadata, updated_at

    def test_get_method(self, sample_dataset_example: v1.DatasetExample) -> None:
        """Test dictionary-style get method."""
        proxy = ExampleProxy(sample_dataset_example)

        assert proxy.get("id") == "test-example-123"
        assert proxy.get("nonexistent") is None
        assert proxy.get("nonexistent", "default") == "default"


class TestExampleProxyProperties:
    """Test suite for ExampleProxy property access."""

    def test_property_access(self, sample_dataset_example: v1.DatasetExample) -> None:
        """Test object-style property access."""
        proxy = ExampleProxy(sample_dataset_example)

        assert proxy.id == "test-example-123"
        expected_datetime = datetime.fromisoformat("2024-01-15T10:30:00+00:00")
        assert proxy.updated_at == expected_datetime
        assert proxy.input == {"question": "What is the capital of France?", "context": "Geography"}
        assert proxy.output == {"answer": "Paris", "confidence": 0.95}
        assert proxy.metadata == {"source": "test", "category": "geography"}

    def test_property_types(self, sample_dataset_example: v1.DatasetExample) -> None:
        """Test that property types match expected types."""
        proxy = ExampleProxy(sample_dataset_example)

        assert isinstance(proxy.id, str)
        assert isinstance(proxy.updated_at, datetime)
        assert isinstance(proxy.input, Mapping)
        assert isinstance(proxy.output, Mapping)
        assert isinstance(proxy.metadata, Mapping)


class TestExampleProxyImmutability:
    """Test suite for ExampleProxy immutability enforcement."""

    def test_cannot_set_attributes(self, sample_dataset_example: v1.DatasetExample) -> None:
        """Test that setting attributes raises AttributeError."""
        proxy = ExampleProxy(sample_dataset_example)

        with pytest.raises(AttributeError, match="object is immutable"):
            proxy.id = "new-id"  # type: ignore[misc]

        with pytest.raises(AttributeError, match="object is immutable"):
            proxy.new_attribute = "value"

    def test_cannot_delete_attributes(self, sample_dataset_example: v1.DatasetExample) -> None:
        """Test that deleting attributes raises AttributeError."""
        proxy = ExampleProxy(sample_dataset_example)

        with pytest.raises(AttributeError, match="object is immutable"):
            del proxy.id  # pyright: ignore[reportAttributeAccessIssue]


class TestExampleProxyEquivalence:
    """Test suite for ensuring ExampleProxy behaves equivalently to direct dict access."""

    def test_equivalent_access_patterns(self, sample_dataset_example: v1.DatasetExample) -> None:
        """Test that object-style and dict-style access return equivalent values."""
        proxy = ExampleProxy(sample_dataset_example)

        # Most fields should return identical values
        assert proxy.id == proxy["id"]
        assert proxy.input == proxy["input"]
        assert proxy.output == proxy["output"]
        assert proxy.metadata == proxy["metadata"]

        # updated_at is special: property returns datetime, dict access returns string
        assert isinstance(proxy.updated_at, datetime)
        assert isinstance(proxy["updated_at"], str)
        assert proxy["updated_at"] == "2024-01-15T10:30:00Z"

    def test_data_consistency(self, sample_dataset_example: v1.DatasetExample) -> None:
        """Test that proxy data remains consistent with wrapped object."""
        proxy = ExampleProxy(sample_dataset_example)

        # All fields should match the original data
        assert proxy["id"] == sample_dataset_example["id"]
        assert proxy["input"] == sample_dataset_example["input"]
        assert proxy["output"] == sample_dataset_example["output"]
        assert proxy["metadata"] == sample_dataset_example["metadata"]
        assert proxy["updated_at"] == sample_dataset_example["updated_at"]


class TestExampleProxyEdgeCases:
    """Test suite for ExampleProxy edge cases and special scenarios."""

    def test_empty_mappings(self) -> None:
        """Test proxy behavior with empty input/output/metadata."""
        example = v1.DatasetExample(
            id="empty-example",
            updated_at="2024-01-15T10:30:00Z",
            input={},
            output={},
            metadata={},
        )
        proxy = ExampleProxy(example)

        assert proxy.input == {}
        assert proxy.output == {}
        assert proxy.metadata == {}
        assert len(proxy.input) == 0

    def test_repr_format(self, sample_dataset_example: v1.DatasetExample) -> None:
        """Test string representation format."""
        proxy = ExampleProxy(sample_dataset_example)
        repr_str = repr(proxy)

        assert "ExampleProxy(" in repr_str
        assert "test-example-123" in repr_str

    def test_nested_data_access(self) -> None:
        """Test access to nested data structures."""
        example = v1.DatasetExample(
            id="nested-example",
            updated_at="2024-01-15T10:30:00Z",
            input={"nested": {"level1": {"level2": "deep_value"}}},
            output={"results": [{"score": 0.8}, {"score": 0.9}]},
            metadata={"tags": ["test", "nested"], "config": {"enabled": True}},
        )
        proxy = ExampleProxy(example)

        # Test nested access through properties
        assert proxy.input["nested"]["level1"]["level2"] == "deep_value"
        assert proxy.output["results"][0]["score"] == 0.8
        assert proxy.metadata["tags"] == ["test", "nested"]
        assert proxy.metadata["config"]["enabled"] is True
