import pytest

from phoenix.server.utils import get_root_path, prepend_root_path, strip_root_path


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


class TestStripRootPath:
    """Tests for removing the root path prefix from request paths."""

    @pytest.mark.parametrize(
        "root_path,input_path,expected_result",
        [
            # No root path cases
            ("", "/login", "/login"),
            (None, "/login", "/login"),
            ("/", "/login", "/login"),
            # Standard root path cases
            ("/app/phoenix", "/app/phoenix/login", "/login"),
            ("/app/phoenix", "/app/phoenix/oauth2/authorize", "/oauth2/authorize"),
            # Exact match yields "/"
            ("/app/phoenix", "/app/phoenix", "/"),
            # Root path normalization cases
            ("app/phoenix", "/app/phoenix/login", "/login"),
            ("/app/phoenix/", "/app/phoenix/login", "/login"),
            # Prefix must match a full path segment
            ("/app/phoenix", "/app/phoenixfoo", "/app/phoenixfoo"),
            # Paths outside the root path are unchanged
            ("/app/phoenix", "/other", "/other"),
            ("/app/phoenix", "/", "/"),
        ],
    )
    def test_strip_root_path_scenarios(
        self, root_path: str, input_path: str, expected_result: str
    ) -> None:
        """Should remove the root path prefix only when it matches a full segment."""
        scope = {"root_path": root_path}
        result = strip_root_path(scope, input_path)
        assert result == expected_result

    @pytest.mark.parametrize(
        "root_path,input_path",
        [
            ("/app/phoenix", "/login"),
            ("/app/phoenix", "/oauth2/authorize"),
            ("", "/login"),
        ],
    )
    def test_strip_inverts_prepend(self, root_path: str, input_path: str) -> None:
        """strip_root_path should undo prepend_root_path for normalized paths."""
        scope = {"root_path": root_path}
        assert strip_root_path(scope, prepend_root_path(scope, input_path)) == input_path
