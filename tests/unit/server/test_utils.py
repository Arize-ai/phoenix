import pytest

from phoenix.server.utils import get_root_path, prepend_root_path


class TestGetRootPath:
    """Tests for extracting root path from ASGI scope."""

    @pytest.mark.parametrize(
        "scope_root_path,expected",
        [
            ("/app/phoenix", "/app/phoenix"),
            ("", ""),
            (None, ""),
            ("/app/phoenix/", "/app/phoenix"),
            ("app/phoenix", "/app/phoenix"),
            ("/app/phoenix///", "/app/phoenix"),
            ("/", ""),
        ],
    )
    def test_get_root_path_extraction(self, scope_root_path: str, expected: str) -> None:
        """Should extract and normalize root path from scope, stripping trailing slashes."""
        scope = {"root_path": scope_root_path}
        result = get_root_path(scope)
        assert result == expected


class TestPrependRootPath:
    """Tests for prepending root path to URLs with normalization."""

    @pytest.mark.parametrize(
        "root_path,input_path,expected_result",
        [
            # No root path cases
            ("", "/login", "/login"),
            ("", "login", "/login"),
            (None, "/login", "/login"),
            # Standard root path cases
            ("/app/phoenix", "/login", "/app/phoenix/login"),
            ("/app/phoenix", "login", "/app/phoenix/login"),
            # Path normalization cases
            ("app/phoenix", "/login", "/app/phoenix/login"),
            ("app/phoenix", "login", "/app/phoenix/login"),
            ("/app/phoenix/", "/login", "/app/phoenix/login"),
            # Edge cases
            ("/app/phoenix///", "/login", "/app/phoenix/login"),
            ("/", "/login", "/login"),
            ("app/phoenix///", "reset-password", "/app/phoenix/reset-password"),
            # Root path "/" cases (no trailing slash in result)
            ("/app/phoenix", "/", "/app/phoenix"),
            ("", "/", "/"),
            (None, "/", "/"),
            # Empty string input cases
            ("/app/phoenix", "", "/app/phoenix"),
            ("", "", "/"),
            (None, "", "/"),
            # Trailing slash in input path (should be stripped)
            ("/app/phoenix", "login/", "/app/phoenix/login"),
            ("/app/phoenix", "/login/", "/app/phoenix/login"),
            ("", "login/", "/login"),
            ("/app/phoenix", "abc/def/", "/app/phoenix/abc/def"),
            ("/app/phoenix", "/login///", "/app/phoenix/login"),
            ("", "login///", "/login"),
        ],
    )
    def test_prepend_root_path_scenarios(
        self, root_path: str, input_path: str, expected_result: str
    ) -> None:
        """Should prepend root path to input path with proper normalization."""
        scope = {"root_path": root_path}
        result = prepend_root_path(scope, input_path)
        assert result == expected_result
