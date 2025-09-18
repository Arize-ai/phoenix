"""Tests for URL utilities."""

import pytest

from phoenix.client.utils.url_utils import BaseURL


class TestBaseURL:
    """Test suite for BaseURL utility class."""

    def test_normalize_base_url_removes_trailing_slash(self):
        """Test that trailing slashes are removed during normalization."""
        test_cases = [
            ("http://localhost:8000/", "http://localhost:8000"),
            ("https://example.com/", "https://example.com"),
            ("https://api.example.com/v1/", "https://api.example.com/v1"),
            ("http://localhost:8000/api/", "http://localhost:8000/api"),
        ]
        
        for input_url, expected in test_cases:
            assert BaseURL._normalize_base_url(input_url) == expected

    def test_normalize_base_url_preserves_no_trailing_slash(self):
        """Test that URLs without trailing slashes are preserved."""
        test_cases = [
            "http://localhost:8000",
            "https://example.com",
            "https://api.example.com/v1",
            "http://localhost:8000/api",
        ]
        
        for url in test_cases:
            assert BaseURL._normalize_base_url(url) == url

    def test_init_normalizes_base_url(self):
        """Test that __init__ properly normalizes the base URL."""
        base_url = BaseURL("http://localhost:8000/")
        assert str(base_url) == "http://localhost:8000"

    def test_join_single_path_segment(self):
        """Test joining a single path segment."""
        base_url = BaseURL("http://localhost:8000")
        result = base_url.join("datasets")
        assert result == "http://localhost:8000/datasets"

    def test_join_multiple_path_segments(self):
        """Test joining multiple path segments."""
        base_url = BaseURL("http://localhost:8000")
        result = base_url.join("datasets", "123", "experiments")
        assert result == "http://localhost:8000/datasets/123/experiments"

    def test_join_with_leading_trailing_slashes(self):
        """Test that join handles path segments with leading/trailing slashes."""
        base_url = BaseURL("http://localhost:8000")
        result = base_url.join("/datasets/", "/123/", "/experiments/")
        assert result == "http://localhost:8000/datasets/123/experiments"

    def test_join_with_empty_segments(self):
        """Test that join handles empty segments gracefully."""
        base_url = BaseURL("http://localhost:8000")
        result = base_url.join("datasets", "", "123", "", "experiments")
        assert result == "http://localhost:8000/datasets/123/experiments"

    def test_join_with_no_segments(self):
        """Test that join with no segments returns the base URL."""
        base_url = BaseURL("http://localhost:8000")
        result = base_url.join()
        assert result == "http://localhost:8000"

    def test_join_with_query_parameters(self):
        """Test joining path segments and then adding query parameters manually."""
        base_url = BaseURL("http://localhost:8000")
        result = base_url.join("datasets", "123", "compare")
        result_with_query = f"{result}?experimentId=456"
        assert result_with_query == "http://localhost:8000/datasets/123/compare?experimentId=456"

    def test_str_representation(self):
        """Test string representation of BaseURL."""
        base_url = BaseURL("http://localhost:8000/")
        assert str(base_url) == "http://localhost:8000"

    def test_repr_representation(self):
        """Test repr representation of BaseURL."""
        base_url = BaseURL("http://localhost:8000/")
        assert repr(base_url) == "BaseURL('http://localhost:8000')"

    @pytest.mark.parametrize("input_url,expected_normalized", [
        ("http://localhost:8000", "http://localhost:8000"),
        ("http://localhost:8000/", "http://localhost:8000"),
        ("https://example.com", "https://example.com"),
        ("https://example.com/", "https://example.com"),
        ("https://api.example.com/v1", "https://api.example.com/v1"),
        ("https://api.example.com/v1/", "https://api.example.com/v1"),
        ("http://localhost:8000/api", "http://localhost:8000/api"),
        ("http://localhost:8000/api/", "http://localhost:8000/api"),
    ])
    def test_various_base_url_formats(self, input_url, expected_normalized):
        """Test BaseURL with various input formats."""
        base_url = BaseURL(input_url)
        assert str(base_url) == expected_normalized

    def test_experiment_url_construction_scenarios(self):
        """Test realistic experiment URL construction scenarios."""
        test_cases = [
            {
                "base_url": "http://localhost:8000",
                "dataset_id": "test-dataset",
                "experiment_id": "test-experiment",
                "expected_experiments_url": "http://localhost:8000/datasets/test-dataset/experiments",
                "expected_experiment_url": "http://localhost:8000/datasets/test-dataset/compare?experimentId=test-experiment",
            },
            {
                "base_url": "http://localhost:8000/",
                "dataset_id": "test-dataset",
                "experiment_id": "test-experiment",
                "expected_experiments_url": "http://localhost:8000/datasets/test-dataset/experiments",
                "expected_experiment_url": "http://localhost:8000/datasets/test-dataset/compare?experimentId=test-experiment",
            },
            {
                "base_url": "https://api.example.com/phoenix",
                "dataset_id": "my-dataset",
                "experiment_id": "exp-123",
                "expected_experiments_url": "https://api.example.com/phoenix/datasets/my-dataset/experiments",
                "expected_experiment_url": "https://api.example.com/phoenix/datasets/my-dataset/compare?experimentId=exp-123",
            },
            {
                "base_url": "https://api.example.com/phoenix/",
                "dataset_id": "my-dataset",
                "experiment_id": "exp-123",
                "expected_experiments_url": "https://api.example.com/phoenix/datasets/my-dataset/experiments",
                "expected_experiment_url": "https://api.example.com/phoenix/datasets/my-dataset/compare?experimentId=exp-123",
            },
        ]

        for case in test_cases:
            base_url = BaseURL(case["base_url"])
            
            # Test dataset experiments URL
            experiments_url = base_url.join("datasets", case["dataset_id"], "experiments")
            assert experiments_url == case["expected_experiments_url"]
            
            # Test experiment URL (without query params)
            experiment_base = base_url.join("datasets", case["dataset_id"], "compare")
            experiment_url = f"{experiment_base}?experimentId={case['experiment_id']}"
            assert experiment_url == case["expected_experiment_url"]

    def test_no_double_slashes_in_any_scenario(self):
        """Test that no double slashes are ever generated (except in protocol)."""
        base_urls = [
            "http://localhost:8000",
            "http://localhost:8000/",
            "https://example.com",
            "https://example.com/",
            "https://api.example.com/v1",
            "https://api.example.com/v1/",
        ]
        
        path_combinations = [
            ("datasets",),
            ("datasets", "123"),
            ("datasets", "123", "experiments"),
            ("/datasets/",),
            ("/datasets/", "/123/"),
            ("/datasets/", "/123/", "/experiments/"),
            ("", "datasets", "", "123", ""),
        ]
        
        for base_url_str in base_urls:
            base_url = BaseURL(base_url_str)
            for paths in path_combinations:
                if paths:  # Skip empty path combinations
                    result = base_url.join(*paths)
                    # Check for double slashes, excluding the protocol part
                    url_without_protocol = result.replace("https://", "").replace("http://", "")
                    assert "//" not in url_without_protocol, f"Double slash found in: {result}"