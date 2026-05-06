"""Unit tests for the WASM binary resolver / download contract.

These tests intentionally do NOT `pytest.importorskip("wasmtime")` — the
capability-probe path (``resolve_wasm_binary_if_present``) and the env-var
override on ``ensure_wasm_binary`` must be exercised even on installs
without the ``wasm`` extra, since they back ``WASMAdapter.probe_binary()``
in the GraphQL ``SandboxBackends`` resolver.
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest

from phoenix.server.sandbox._download import (
    PHOENIX_WASM_BINARY_PATH_ENV,
    WASMBinaryUnavailable,
    ensure_wasm_binary,
    resolve_wasm_binary_if_present,
)

_FILENAME = "python-3.12.0.wasm"


# ---------------------------------------------------------------------------
# resolve_wasm_binary_if_present (capability-probe path)
# ---------------------------------------------------------------------------


class TestResolveWasmBinaryIfPresent:
    def test_env_var_set_and_file_exists_returns_path(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        binary = tmp_path / "operator-binary.wasm"
        binary.write_bytes(b"fake wasm")
        monkeypatch.setenv(PHOENIX_WASM_BINARY_PATH_ENV, str(binary))

        # cache_dir intentionally points at an empty dir to prove the
        # env-var path takes precedence and no cache lookup happened.
        empty_cache = tmp_path / "empty-cache"
        result = resolve_wasm_binary_if_present(cache_dir=empty_cache)

        assert result == binary
        assert not empty_cache.exists(), "probe path must not create cache_dir as a side effect"

    def test_env_var_set_and_file_missing_returns_none(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        missing = tmp_path / "does-not-exist.wasm"
        monkeypatch.setenv(PHOENIX_WASM_BINARY_PATH_ENV, str(missing))

        # Even if a cache entry exists, the env-var-set-but-missing case
        # must NOT silently fall back to the cache; the operator path is
        # authoritative and the caller distinguishes statusDetail.
        cache_dir = tmp_path / "cache"
        cache_dir.mkdir()
        (cache_dir / _FILENAME).write_bytes(b"cached")

        assert resolve_wasm_binary_if_present(cache_dir=cache_dir, filename=_FILENAME) is None

    def test_env_var_unset_and_cache_present_returns_cache_path(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv(PHOENIX_WASM_BINARY_PATH_ENV, raising=False)
        cache_dir = tmp_path / "cache"
        cache_dir.mkdir()
        cached = cache_dir / _FILENAME
        cached.write_bytes(b"cached wasm")

        result = resolve_wasm_binary_if_present(cache_dir=cache_dir, filename=_FILENAME)

        assert result == cached

    def test_env_var_unset_and_cache_absent_returns_none(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv(PHOENIX_WASM_BINARY_PATH_ENV, raising=False)
        cache_dir = tmp_path / "cache"
        # Note: cache_dir intentionally not created.

        assert resolve_wasm_binary_if_present(cache_dir=cache_dir, filename=_FILENAME) is None
        assert not cache_dir.exists(), "probe path must not create cache_dir as a side effect"

    def test_probe_path_never_calls_urlretrieve(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """The capability-probe surface must be side-effect-free.

        ``WASMAdapter.probe_binary()`` is invoked from the
        ``SandboxBackends`` GraphQL resolver on every render of the
        sandbox-config UI. A network round-trip there would be a serious
        regression.
        """
        monkeypatch.delenv(PHOENIX_WASM_BINARY_PATH_ENV, raising=False)
        cache_dir = tmp_path / "cache"

        with patch("phoenix.server.sandbox._download.urllib.request.urlretrieve") as mock_retrieve:
            for _ in range(3):
                resolve_wasm_binary_if_present(cache_dir=cache_dir, filename=_FILENAME)

        mock_retrieve.assert_not_called()
        assert not cache_dir.exists()


# ---------------------------------------------------------------------------
# ensure_wasm_binary (execution path)
# ---------------------------------------------------------------------------


class TestEnsureWasmBinaryEnvVarOverride:
    def test_env_var_set_and_file_exists_returns_path_without_download(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        binary = tmp_path / "operator-binary.wasm"
        binary.write_bytes(b"fake wasm")
        monkeypatch.setenv(PHOENIX_WASM_BINARY_PATH_ENV, str(binary))

        with patch("phoenix.server.sandbox._download.urllib.request.urlretrieve") as mock_retrieve:
            result = ensure_wasm_binary(
                cache_dir=tmp_path / "unused-cache",
                expected_sha256="",
            )

        assert result == binary
        mock_retrieve.assert_not_called()

    def test_env_var_set_and_file_missing_raises(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        missing = tmp_path / "missing.wasm"
        monkeypatch.setenv(PHOENIX_WASM_BINARY_PATH_ENV, str(missing))

        with patch("phoenix.server.sandbox._download.urllib.request.urlretrieve") as mock_retrieve:
            with pytest.raises(WASMBinaryUnavailable, match=str(missing)):
                ensure_wasm_binary(
                    cache_dir=tmp_path / "unused-cache",
                    expected_sha256="",
                )

        # Critical: an operator-set-but-missing path MUST NOT silently
        # trigger the lazy download. Anything else masks misconfiguration.
        mock_retrieve.assert_not_called()


class TestEnsureWasmBinaryEnvVarUnset:
    def test_env_var_unset_and_cache_present_returns_cache_path(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv(PHOENIX_WASM_BINARY_PATH_ENV, raising=False)
        cache_dir = tmp_path / "cache"
        cache_dir.mkdir()
        cached = cache_dir / _FILENAME
        cached.write_bytes(b"cached wasm")

        with patch("phoenix.server.sandbox._download.urllib.request.urlretrieve") as mock_retrieve:
            result = ensure_wasm_binary(
                cache_dir=cache_dir,
                filename=_FILENAME,
                expected_sha256="",
            )

        assert result == cached
        mock_retrieve.assert_not_called()

    def test_env_var_unset_and_cache_absent_triggers_lazy_download(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv(PHOENIX_WASM_BINARY_PATH_ENV, raising=False)
        cache_dir = tmp_path / "cache"

        # Stub urlretrieve to simulate a successful download by writing
        # the destination file ourselves; we don't actually go to the
        # network.
        def _fake_retrieve(_url: str, dest: str) -> None:
            Path(dest).write_bytes(b"downloaded wasm")

        with patch(
            "phoenix.server.sandbox._download.urllib.request.urlretrieve",
            side_effect=_fake_retrieve,
        ) as mock_retrieve:
            result = ensure_wasm_binary(
                cache_dir=cache_dir,
                filename=_FILENAME,
                expected_sha256="",
            )

        mock_retrieve.assert_called_once()
        assert result == cache_dir / _FILENAME
        assert result.read_bytes() == b"downloaded wasm"

    def test_env_var_empty_string_treated_as_unset(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """An empty ``PHOENIX_WASM_BINARY_PATH`` should NOT trigger the
        operator-path branch — empty string is a common docker-compose
        artifact (e.g. unset variable expansion) and treating it as
        authoritative would surface a confusing
        ``WASMBinaryUnavailable("PHOENIX_WASM_BINARY_PATH= is set ...")``
        on every probe.
        """
        monkeypatch.setenv(PHOENIX_WASM_BINARY_PATH_ENV, "")
        cache_dir = tmp_path / "cache"
        cache_dir.mkdir()
        cached = cache_dir / _FILENAME
        cached.write_bytes(b"cached wasm")

        # Probe path: should fall through to cache lookup.
        result = resolve_wasm_binary_if_present(cache_dir=cache_dir, filename=_FILENAME)
        assert result == cached
