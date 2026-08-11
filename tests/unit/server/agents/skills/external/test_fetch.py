from __future__ import annotations

import io
import json
import tarfile
from pathlib import Path
from typing import Any

import pytest

import phoenix.server.agents.skills.external.fetch as fetch_module
from phoenix.server.agents.skills.external.diagnostics import SkillDiagnosticCode
from phoenix.server.agents.skills.external.fetch import (
    LOCKFILE_NAME,
    _strip_leading_component,
    fetch_remote_source,
)
from phoenix.server.agents.skills.external.sources import RemoteSkillSource

SKILL_MD = "---\nname: remote-skill\ndescription: From a repo.\n---\n\nRemote body.\n"


def _tarball(members: dict[str, str], *, prefix: str = "owner-repo-abc123") -> bytes:
    """Build a gzipped tarball shaped like a GitHub source archive."""
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:gz") as tar:
        for name, content in members.items():
            payload = content.encode("utf-8")
            info = tarfile.TarInfo(name=f"{prefix}/{name}" if prefix else name)
            info.size = len(payload)
            tar.addfile(info, io.BytesIO(payload))
    return buffer.getvalue()


@pytest.fixture
def source() -> RemoteSkillSource:
    return RemoteSkillSource(raw="owner/repo@v1", owner="owner", repo="repo", ref="v1")


def _serve(monkeypatch: pytest.MonkeyPatch, archive: bytes) -> None:
    """Stub the download so no network is touched."""

    def fake_download(source: RemoteSkillSource, *, timeout_seconds: float) -> tuple[Path, str]:
        import hashlib
        import tempfile

        handle = tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False)
        with handle:
            handle.write(archive)
        return Path(handle.name), hashlib.sha256(archive).hexdigest()

    monkeypatch.setattr(fetch_module, "_download", fake_download)


class TestStripLeadingComponent:
    @pytest.mark.parametrize(
        ("name", "expected"),
        [
            ("owner-repo-abc/skills/demo/SKILL.md", "skills/demo/SKILL.md"),
            ("owner-repo-abc/SKILL.md", "SKILL.md"),
            ("owner-repo-abc", None),
            ("", None),
            ("/etc/passwd", None),
            ("owner-repo/../../etc/passwd", None),
            ("owner-repo/a/../../../etc/passwd", None),
        ],
    )
    def test_classification(self, name: str, expected: str | None) -> None:
        assert _strip_leading_component(name) == expected

    def test_a_null_byte_is_rejected(self) -> None:
        assert _strip_leading_component("owner-repo/a\x00b") is None


class TestFetch:
    def test_extracts_and_strips_the_top_level_directory(
        self, source: RemoteSkillSource, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        _serve(monkeypatch, _tarball({"remote-skill/SKILL.md": SKILL_MD}))

        fetched, diagnostics = fetch_remote_source(source, cache_dir=tmp_path)

        assert diagnostics == []
        assert fetched is not None
        assert (fetched.path / "remote-skill" / "SKILL.md").read_text(encoding="utf-8") == SKILL_MD

    def test_records_the_pin_in_a_lockfile(
        self, source: RemoteSkillSource, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        archive = _tarball({"remote-skill/SKILL.md": SKILL_MD})
        _serve(monkeypatch, archive)

        fetched, _ = fetch_remote_source(source, cache_dir=tmp_path)

        lock: dict[str, Any] = json.loads((tmp_path / LOCKFILE_NAME).read_text(encoding="utf-8"))
        entry = lock["sources"]["owner/repo"]
        assert entry["ref"] == "v1"
        assert fetched is not None
        assert entry["digest"] == fetched.digest

    def test_a_second_fetch_replaces_the_cache(
        self, source: RemoteSkillSource, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        _serve(monkeypatch, _tarball({"remote-skill/SKILL.md": SKILL_MD}))
        fetch_remote_source(source, cache_dir=tmp_path)

        _serve(monkeypatch, _tarball({"other-skill/SKILL.md": SKILL_MD}))
        fetched, _ = fetch_remote_source(source, cache_dir=tmp_path)

        assert fetched is not None
        assert (fetched.path / "other-skill").is_dir()
        assert not (fetched.path / "remote-skill").exists()

    def test_a_member_escaping_the_destination_is_not_written(
        self, source: RemoteSkillSource, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """A hostile archive must not be able to write outside the cache."""
        _serve(
            monkeypatch,
            _tarball({"../../escaped.txt": "owned", "remote-skill/SKILL.md": SKILL_MD}),
        )

        fetched, _ = fetch_remote_source(source, cache_dir=tmp_path / "cache")

        assert fetched is not None
        assert (fetched.path / "remote-skill" / "SKILL.md").is_file()
        assert not (tmp_path / "escaped.txt").exists()
        assert not (tmp_path / "cache" / "escaped.txt").exists()

    def test_an_absolute_member_is_not_written(
        self, source: RemoteSkillSource, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        _serve(monkeypatch, _tarball({"SKILL.md": SKILL_MD}, prefix=""))

        fetched, _ = fetch_remote_source(source, cache_dir=tmp_path)

        # With no top-level directory to strip, every member is rejected rather than
        # landing at the cache root.
        assert fetched is not None
        assert list(fetched.path.iterdir()) == []

    def test_a_symlink_member_is_skipped(
        self, source: RemoteSkillSource, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        buffer = io.BytesIO()
        with tarfile.open(fileobj=buffer, mode="w:gz") as tar:
            link = tarfile.TarInfo(name="owner-repo-abc/escape")
            link.type = tarfile.SYMTYPE
            link.linkname = "/etc/passwd"
            tar.addfile(link)
            payload = SKILL_MD.encode("utf-8")
            info = tarfile.TarInfo(name="owner-repo-abc/remote-skill/SKILL.md")
            info.size = len(payload)
            tar.addfile(info, io.BytesIO(payload))
        _serve(monkeypatch, buffer.getvalue())

        fetched, _ = fetch_remote_source(source, cache_dir=tmp_path)

        assert fetched is not None
        assert not (fetched.path / "escape").exists()
        assert (fetched.path / "remote-skill" / "SKILL.md").is_file()


class TestFallback:
    def test_falls_back_to_the_cache_when_the_fetch_fails(
        self, source: RemoteSkillSource, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        _serve(monkeypatch, _tarball({"remote-skill/SKILL.md": SKILL_MD}))
        fetch_remote_source(source, cache_dir=tmp_path)

        def explode(*args: object, **kwargs: object) -> None:
            raise OSError("network unreachable")

        monkeypatch.setattr(fetch_module, "_download", explode)

        fetched, diagnostics = fetch_remote_source(source, cache_dir=tmp_path)

        assert fetched is not None
        assert fetched.from_cache
        assert (fetched.path / "remote-skill" / "SKILL.md").is_file()
        assert [d.code for d in diagnostics] == [SkillDiagnosticCode.FETCH_FAILED]

    def test_gives_up_when_there_is_no_cache(
        self, source: RemoteSkillSource, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        def explode(*args: object, **kwargs: object) -> None:
            raise OSError("network unreachable")

        monkeypatch.setattr(fetch_module, "_download", explode)

        fetched, diagnostics = fetch_remote_source(source, cache_dir=tmp_path)

        assert fetched is None
        assert [d.code for d in diagnostics] == [SkillDiagnosticCode.FETCH_FAILED]

    def test_a_corrupt_archive_leaves_the_previous_cache_intact(
        self, source: RemoteSkillSource, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        _serve(monkeypatch, _tarball({"remote-skill/SKILL.md": SKILL_MD}))
        fetch_remote_source(source, cache_dir=tmp_path)

        _serve(monkeypatch, b"this is not a tarball")
        fetched, diagnostics = fetch_remote_source(source, cache_dir=tmp_path)

        assert fetched is not None
        assert fetched.from_cache
        assert (fetched.path / "remote-skill" / "SKILL.md").is_file()
        assert [d.code for d in diagnostics] == [SkillDiagnosticCode.FETCH_FAILED]

    def test_a_corrupt_lockfile_is_rewritten_rather_than_fatal(
        self, source: RemoteSkillSource, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        (tmp_path / LOCKFILE_NAME).write_text("{not json", encoding="utf-8")
        _serve(monkeypatch, _tarball({"remote-skill/SKILL.md": SKILL_MD}))

        fetched, _ = fetch_remote_source(source, cache_dir=tmp_path)

        assert fetched is not None
        lock = json.loads((tmp_path / LOCKFILE_NAME).read_text(encoding="utf-8"))
        assert "owner/repo" in lock["sources"]
