"""Tests intentionally do NOT pytest.importorskip("wasmtime") — the
capability-probe path and env-var override must work on installs without the
wasm extra, since they back WASMAdapter.probe_binary() in the GraphQL
SandboxBackends resolver.
"""

from __future__ import annotations

import re
from pathlib import Path
from unittest.mock import patch

import pytest

from phoenix.server.sandbox._download import (
    WASMBinaryUnavailable,
    ensure_wasm_binary,
    no_local_storage_message,
    prefetch_wasm_binary_if_needed,
    resolve_wasm_binary_if_present,
)

_FILENAME = "python-3.12.0.wasm"


class TestResolveWasmBinaryIfPresent:
    def test_env_var_set_and_file_exists_returns_path(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        binary = tmp_path / "operator-binary.wasm"
        binary.write_bytes(b"fake wasm")
        monkeypatch.setenv("PHOENIX_WASM_BINARY_PATH", str(binary))

        # cache_dir intentionally points at an empty dir to prove the
        # env-var path takes precedence and no cache lookup happened.
        empty_cache = tmp_path / "empty-cache"
        result = resolve_wasm_binary_if_present(wasm_dir=empty_cache)

        assert result == binary
        assert not empty_cache.exists(), "probe path must not create cache_dir as a side effect"

    def test_env_var_set_and_file_missing_returns_none(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        missing = tmp_path / "does-not-exist.wasm"
        monkeypatch.setenv("PHOENIX_WASM_BINARY_PATH", str(missing))

        # Even if a cache entry exists, the env-var-set-but-missing case
        # must NOT silently fall back to the cache; the operator path is
        # authoritative and the caller distinguishes statusDetail.
        cache_dir = tmp_path / "cache"
        cache_dir.mkdir()
        (cache_dir / _FILENAME).write_bytes(b"cached")

        assert resolve_wasm_binary_if_present(wasm_dir=cache_dir, filename=_FILENAME) is None

    def test_env_var_unset_and_cache_present_returns_cache_path(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("PHOENIX_WASM_BINARY_PATH", raising=False)
        cache_dir = tmp_path / "cache"
        cache_dir.mkdir()
        cached = cache_dir / _FILENAME
        cached.write_bytes(b"cached wasm")

        result = resolve_wasm_binary_if_present(wasm_dir=cache_dir, filename=_FILENAME)

        assert result == cached

    def test_env_var_unset_and_cache_absent_returns_none(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("PHOENIX_WASM_BINARY_PATH", raising=False)
        cache_dir = tmp_path / "cache"
        # Note: cache_dir intentionally not created.

        assert resolve_wasm_binary_if_present(wasm_dir=cache_dir, filename=_FILENAME) is None
        assert not cache_dir.exists(), "probe path must not create cache_dir as a side effect"

    def test_probe_path_never_calls_urlretrieve(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """probe_binary() runs on every render of the sandbox-config UI; a
        network round-trip there would regress the resolver.
        """
        monkeypatch.delenv("PHOENIX_WASM_BINARY_PATH", raising=False)
        cache_dir = tmp_path / "cache"

        with patch("phoenix.server.sandbox._download.urllib.request.urlretrieve") as mock_retrieve:
            for _ in range(3):
                resolve_wasm_binary_if_present(wasm_dir=cache_dir, filename=_FILENAME)

        mock_retrieve.assert_not_called()
        assert not cache_dir.exists()


class TestEnsureWasmBinaryEnvVarOverride:
    def test_env_var_set_and_file_exists_returns_path_without_download(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        binary = tmp_path / "operator-binary.wasm"
        binary.write_bytes(b"fake wasm")
        monkeypatch.setenv("PHOENIX_WASM_BINARY_PATH", str(binary))

        with patch("phoenix.server.sandbox._download.urllib.request.urlretrieve") as mock_retrieve:
            result = ensure_wasm_binary(
                wasm_dir=tmp_path / "unused-cache",
                expected_sha256="",
            )

        assert result == binary
        mock_retrieve.assert_not_called()

    def test_env_var_set_and_file_missing_raises(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        missing = tmp_path / "missing.wasm"
        monkeypatch.setenv("PHOENIX_WASM_BINARY_PATH", str(missing))

        with patch("phoenix.server.sandbox._download.urllib.request.urlretrieve") as mock_retrieve:
            with pytest.raises(WASMBinaryUnavailable, match=re.escape(str(missing))):
                ensure_wasm_binary(
                    wasm_dir=tmp_path / "unused-cache",
                    expected_sha256="",
                )

        # Critical: an operator-set-but-missing path MUST NOT silently
        # trigger the lazy download. Anything else masks misconfiguration.
        mock_retrieve.assert_not_called()


class TestEnsureWasmBinaryEnvVarUnset:
    def test_env_var_unset_and_cache_present_returns_cache_path(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("PHOENIX_WASM_BINARY_PATH", raising=False)
        cache_dir = tmp_path / "cache"
        cache_dir.mkdir()
        cached = cache_dir / _FILENAME
        cached.write_bytes(b"cached wasm")

        with patch("phoenix.server.sandbox._download.urllib.request.urlretrieve") as mock_retrieve:
            result = ensure_wasm_binary(
                wasm_dir=cache_dir,
                filename=_FILENAME,
                expected_sha256="",
            )

        assert result == cached
        mock_retrieve.assert_not_called()

    def test_env_var_unset_and_cache_absent_triggers_lazy_download(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("PHOENIX_WASM_BINARY_PATH", raising=False)
        cache_dir = tmp_path / "cache"

        def _fake_retrieve(_url: str, dest: str) -> None:
            Path(dest).write_bytes(b"downloaded wasm")

        with patch(
            "phoenix.server.sandbox._download.urllib.request.urlretrieve",
            side_effect=_fake_retrieve,
        ) as mock_retrieve:
            result = ensure_wasm_binary(
                wasm_dir=cache_dir,
                filename=_FILENAME,
                expected_sha256="",
            )

        mock_retrieve.assert_called_once()
        assert result == cache_dir / _FILENAME
        assert result.read_bytes() == b"downloaded wasm"

    def test_env_var_empty_string_treated_as_unset(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Empty string is a common docker-compose unset-variable artifact;
        treating it as authoritative would surface a confusing
        WASMBinaryUnavailable on every probe.
        """
        monkeypatch.setenv("PHOENIX_WASM_BINARY_PATH", "")
        cache_dir = tmp_path / "cache"
        cache_dir.mkdir()
        cached = cache_dir / _FILENAME
        cached.write_bytes(b"cached wasm")

        result = resolve_wasm_binary_if_present(wasm_dir=cache_dir, filename=_FILENAME)
        assert result == cached

    def test_cached_binary_with_bad_sha256_is_unlinked_and_raises(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        import hashlib

        monkeypatch.delenv("PHOENIX_WASM_BINARY_PATH", raising=False)
        wasm_dir = tmp_path / "wasm"
        wasm_dir.mkdir()
        cached = wasm_dir / _FILENAME
        cached.write_bytes(b"tampered cached payload")

        expected_sha = hashlib.sha256(b"real upstream").hexdigest()

        with pytest.raises(ValueError, match="SHA-256 mismatch"):
            ensure_wasm_binary(
                wasm_dir=wasm_dir,
                filename=_FILENAME,
                expected_sha256=expected_sha,
            )

        assert not cached.exists(), "tampered cached binary must be unlinked on verify failure"

    def test_no_local_storage_raises_unavailable(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("PHOENIX_WASM_BINARY_PATH", raising=False)
        monkeypatch.setattr("phoenix.server.sandbox._download._no_local_storage", lambda: True)
        wasm_dir = tmp_path / "wasm"

        with patch("phoenix.server.sandbox._download.urllib.request.urlretrieve") as mock_retrieve:
            with pytest.raises(WASMBinaryUnavailable) as exc_info:
                ensure_wasm_binary(
                    wasm_dir=wasm_dir,
                    filename=_FILENAME,
                    expected_sha256="",
                )

        assert str(exc_info.value) == no_local_storage_message()
        assert "PHOENIX_WASM_BINARY_PATH" not in str(exc_info.value)
        mock_retrieve.assert_not_called()
        assert not wasm_dir.exists()


class TestPrefetchWasmBinaryIfNeeded:
    async def test_prefetch_downloads_when_missing(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # Pinned sha256 monkeypatched to match the fake payload so the
        # integrity check passes without the real 26MB upstream binary.
        import hashlib

        monkeypatch.delenv("PHOENIX_WASM_BINARY_PATH", raising=False)
        wasm_dir = tmp_path / "wasm"
        monkeypatch.setattr("phoenix.server.sandbox._download._default_wasm_dir", lambda: wasm_dir)

        payload = b"downloaded wasm"
        payload_sha = hashlib.sha256(payload).hexdigest()
        monkeypatch.setattr("phoenix.server.sandbox._download._WASM_SHA256", payload_sha)

        def _fake_retrieve(_url: str, dest: str) -> None:
            Path(dest).write_bytes(payload)

        with patch(
            "phoenix.server.sandbox._download.urllib.request.urlretrieve",
            side_effect=_fake_retrieve,
        ) as mock_retrieve:
            await prefetch_wasm_binary_if_needed()

        mock_retrieve.assert_called_once()
        assert (wasm_dir / _FILENAME).read_bytes() == payload

    async def test_prefetch_fails_soft_on_hash_mismatch(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
    ) -> None:
        import hashlib

        monkeypatch.delenv("PHOENIX_WASM_BINARY_PATH", raising=False)
        wasm_dir = tmp_path / "wasm"
        monkeypatch.setattr("phoenix.server.sandbox._download._default_wasm_dir", lambda: wasm_dir)

        expected_sha = hashlib.sha256(b"real upstream").hexdigest()
        monkeypatch.setattr("phoenix.server.sandbox._download._WASM_SHA256", expected_sha)

        def _poisoned_retrieve(_url: str, dest: str) -> None:
            Path(dest).write_bytes(b"tampered payload")

        with patch(
            "phoenix.server.sandbox._download.urllib.request.urlretrieve",
            side_effect=_poisoned_retrieve,
        ):
            with caplog.at_level("WARNING", logger="phoenix.server.sandbox._download"):
                await prefetch_wasm_binary_if_needed()

        assert not (wasm_dir / _FILENAME).exists(), "tampered binary must be unlinked"
        assert any(
            "integrity check" in record.message and record.levelname == "WARNING"
            for record in caplog.records
        )

    async def test_prefetch_fails_soft_on_download_error(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
    ) -> None:
        monkeypatch.delenv("PHOENIX_WASM_BINARY_PATH", raising=False)
        wasm_dir = tmp_path / "wasm"
        monkeypatch.setattr("phoenix.server.sandbox._download._default_wasm_dir", lambda: wasm_dir)

        with patch(
            "phoenix.server.sandbox._download.urllib.request.urlretrieve",
            side_effect=OSError("network down"),
        ):
            with caplog.at_level("WARNING", logger="phoenix.server.sandbox._download"):
                await prefetch_wasm_binary_if_needed()

        assert any(
            "WASM sandbox binary" in record.message and record.levelname == "WARNING"
            for record in caplog.records
        )
