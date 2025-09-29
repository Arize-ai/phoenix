from unittest.mock import Mock

import pytest

from phoenix.server.api.routers.utils import (
    get_root_path,
    prepend_root_path,
)


class TestGetRootPath:
    """Test the get_root_path utility function."""

    @pytest.mark.parametrize(
        "scope_root_path,expected",
        [
            # Test Case: Normal root path extraction
            # Verifies that a valid root path from ASGI scope is returned correctly
            pytest.param(
                "/api/v1",
                "/api/v1",
                id="normal_root_path",
            ),
            # Test Case: Empty root path handling
            # Verifies that empty string in scope returns empty string
            pytest.param(
                "",
                "",
                id="empty_root_path",
            ),
            # Test Case: None root path handling
            # Verifies that None in scope is converted to empty string
            pytest.param(
                None,
                "",
                id="none_root_path",
            ),
            # Test Case: Root path with trailing slash
            # Verifies that trailing slashes are preserved in extraction
            pytest.param(
                "/api/v1/",
                "/api/v1/",
                id="root_path_with_trailing_slash",
            ),
        ],
    )
    def test_get_root_path_extraction(self, scope_root_path: str, expected: str) -> None:
        """Test that root path is correctly extracted from request scope."""
        request = Mock()
        request.scope = {"root_path": scope_root_path}

        result = get_root_path(request=request)

        assert result == expected


class TestPrependRootPathIfExists:
    """Test the prepend_root_path_if_exists utility function."""

    class TestPathNormalization:
        """Test auto-normalization of input paths."""

        @pytest.mark.parametrize(
            "input_path,expected_normalized_path",
            [
                # Test Case: Path already has leading slash
                # Verifies that correctly formatted paths are preserved
                pytest.param(
                    "/login",
                    "/login",
                    id="path_with_leading_slash",
                ),
                # Test Case: Path missing leading slash gets auto-fixed
                # Verifies that missing leading slash is automatically added
                pytest.param(
                    "login",
                    "/login",
                    id="path_without_leading_slash_gets_fixed",
                ),
                # Test Case: Complex path with query parameters
                # Verifies that complex paths are normalized correctly
                pytest.param(
                    "reset-password?token=abc123",
                    "/reset-password?token=abc123",
                    id="complex_path_normalization",
                ),
            ],
        )
        def test_path_auto_normalization_without_root_path(
            self, input_path: str, expected_normalized_path: str
        ) -> None:
            """Test that input paths are automatically normalized when no root path exists."""
            request = Mock()
            request.scope = {"root_path": ""}

            result = prepend_root_path(request=request, path=input_path)

            assert result == expected_normalized_path

    class TestRootPathHandling:
        """Test handling of various root path configurations."""

        @pytest.mark.parametrize(
            "root_path,input_path,expected_result",
            [
                # Test Case: Standard root path prepending
                # Verifies normal operation with properly formatted inputs
                pytest.param(
                    "/api/v1",
                    "/login",
                    "/api/v1/login",
                    id="standard_prepending",
                ),
                # Test Case: Auto-fix missing slash on root path
                # Verifies that root path missing leading slash gets fixed
                pytest.param(
                    "api/v1",
                    "/login",
                    "/api/v1/login",
                    id="root_path_auto_fix_leading_slash",
                ),
                # Test Case: Auto-fix both root path and input path
                # Verifies that both paths can be auto-normalized simultaneously
                pytest.param(
                    "api/v1",
                    "login",
                    "/api/v1/login",
                    id="both_paths_auto_fixed",
                ),
                # Test Case: Remove trailing slash from root path
                # Verifies that trailing slashes are removed to prevent double slashes
                pytest.param(
                    "/api/v1/",
                    "/login",
                    "/api/v1/login",
                    id="trailing_slash_removal",
                ),
                # Test Case: Complex nested root path
                # Verifies handling of deeper nested root paths
                pytest.param(
                    "/api/v1/phoenix/",
                    "/logout",
                    "/api/v1/phoenix/logout",
                    id="nested_root_path",
                ),
            ],
        )
        def test_root_path_prepending_scenarios(
            self, root_path: str, input_path: str, expected_result: str
        ) -> None:
            """Test various root path prepending scenarios."""
            request = Mock()
            request.scope = {"root_path": root_path}

            result = prepend_root_path(request=request, path=input_path)

            assert result == expected_result

    class TestEmptyRootPathCases:
        """Test behavior when root path is empty or None."""

        @pytest.mark.parametrize(
            "root_path,input_path,expected_result",
            [
                # Test Case: Empty string root path
                # Verifies that empty root path returns just the normalized path
                pytest.param(
                    "",
                    "/login",
                    "/login",
                    id="empty_string_root_path",
                ),
                # Test Case: None root path
                # Verifies that None root path is handled gracefully
                pytest.param(
                    None,
                    "/login",
                    "/login",
                    id="none_root_path",
                ),
                # Test Case: Empty root path with path normalization
                # Verifies path normalization still works when root path is empty
                pytest.param(
                    "",
                    "login",
                    "/login",
                    id="empty_root_path_with_path_normalization",
                ),
            ],
        )
        def test_empty_root_path_handling(
            self, root_path: str, input_path: str, expected_result: str
        ) -> None:
            """Test behavior when no root path is configured."""
            request = Mock()
            request.scope = {"root_path": root_path}

            result = prepend_root_path(request=request, path=input_path)

            assert result == expected_result

    class TestEdgeCases:
        """Test edge cases and potential problem scenarios."""

        @pytest.mark.parametrize(
            "root_path,input_path,expected_result,description",
            [
                # Test Case: Multiple trailing slashes
                # Verifies handling of malformed root paths with multiple trailing slashes
                pytest.param(
                    "/api/v1///",
                    "/login",
                    "/api/v1/login",
                    "multiple_trailing_slashes_removed",
                    id="multiple_trailing_slashes",
                ),
                # Test Case: Root path with just slash
                # Verifies that root path of "/" is handled correctly
                pytest.param(
                    "/",
                    "/login",
                    "/login",
                    "single_slash_root_path_normalized",
                    id="single_slash_root_path",
                ),
                # Test Case: Both paths need extensive normalization
                # Verifies robust handling when both paths need significant fixes
                pytest.param(
                    "api/v1///",
                    "reset-password-with-token",
                    "/api/v1/reset-password-with-token",
                    "extensive_normalization_both_paths",
                    id="extensive_normalization",
                ),
            ],
        )
        def test_edge_case_scenarios(
            self, root_path: str, input_path: str, expected_result: str, description: str
        ) -> None:
            """Test edge cases that could cause issues in production."""
            request = Mock()
            request.scope = {"root_path": root_path}

            result = prepend_root_path(request=request, path=input_path)

            assert result == expected_result, f"Failed scenario: {description}"
