"""
Tests for the removal of the legacy `phoenix.session.client` module.

The legacy client (`px.Client`) was replaced by the `arize-phoenix-client` package.
Reaching for a removed module or a removed top-level alias must fail with actionable
migration guidance instead of an opaque `ModuleNotFoundError`/`AttributeError`.
"""

import importlib
import sys

import pytest

import phoenix as px


class TestRemovedModules:
    @pytest.mark.parametrize("module_name", sorted(px._REMOVED_MODULES))
    def test_import_raises_import_error(self, module_name: str) -> None:
        with pytest.raises(ImportError, match="has been removed"):
            importlib.import_module(module_name)
        # A failed import must not leave a half-initialized module behind.
        assert module_name not in sys.modules

    def test_legacy_client_points_to_replacement_package(self) -> None:
        with pytest.raises(ImportError) as exc_info:
            importlib.import_module("phoenix.session.client")
        message = str(exc_info.value)
        assert "arize-phoenix-client" in message
        assert "from phoenix.client import Client" in message


class TestRemovedAttributes:
    def test_client_points_to_replacement_package(self) -> None:
        with pytest.raises(AttributeError) as exc_info:
            _ = px.Client
        message = str(exc_info.value)
        assert "arize-phoenix-client" in message
        assert "from phoenix.client import Client" in message

    def test_log_evaluations_points_to_annotations_api(self) -> None:
        with pytest.raises(AttributeError) as exc_info:
            _ = px.log_evaluations
        assert "log_span_annotations_dataframe" in str(exc_info.value)

    def test_unknown_attribute_raises_standard_error(self) -> None:
        with pytest.raises(AttributeError, match="has no attribute 'not_an_attribute'"):
            _ = px.not_an_attribute

    @pytest.mark.parametrize("name", sorted(set(px.__all__) - {"evals"}))
    def test_public_exports_are_unaffected(self, name: str) -> None:
        """`__getattr__` must not shadow anything Phoenix actually exports.

        `evals` is excluded because it is a lazily-imported namespace package rather
        than an attribute set by `phoenix/__init__.py`.
        """
        assert hasattr(px, name)
