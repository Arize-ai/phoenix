"""Tests for ``github:`` skills sources: parsing, fetching, caching, and fallback."""

from __future__ import annotations

import io
import logging
import tarfile
from collections.abc import Iterator
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import unquote

import httpx
import pytest

from phoenix.server.mcp.skills import (
    load_external_skills,
    load_skills,
    resolve_skill_roots,
)
from phoenix.server.mcp.skills.github import (
    GitHubSkillSource,
    materialize_github_source,
)

SHA = "0123456789abcdef0123456789abcdef01234567"
OTHER_SHA = "fedcba9876543210fedcba9876543210fedcba98"


def _skill_file(name: str) -> bytes:
    return f"---\nname: {name}\ndescription: d\nsummary: s\n---\n\n{name} body\n".encode()


def _tarball(files: dict[str, bytes], *, top: str = "acme-skills-0123456") -> bytes:
    """A GitHub-style tarball: one top-level directory wrapping every path."""
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:gz") as tar:
        directory = tarfile.TarInfo(top)
        directory.type = tarfile.DIRTYPE
        tar.addfile(directory)
        for name, data in files.items():
            info = tarfile.TarInfo(f"{top}/{name}" if top else name)
            info.size = len(data)
            tar.addfile(info, io.BytesIO(data))
        link = tarfile.TarInfo(f"{top}/link-to-etc")
        link.type = tarfile.SYMTYPE
        link.linkname = "/etc"
        tar.addfile(link)
        escape = tarfile.TarInfo(f"{top}/../escaped.md")
        escape.size = 4
        tar.addfile(escape, io.BytesIO(b"evil"))
        absolute = tarfile.TarInfo("/absolute.md")
        absolute.size = 4
        tar.addfile(absolute, io.BytesIO(b"evil"))
    return buffer.getvalue()


COLLECTION = {
    "README.md": b"about",
    "skills/a-skill/SKILL.md": _skill_file("a-skill"),
    "skills/a-skill/references/guide.md": b"guide",
    "skills/a-skill/references/deep/more.md": b"more",
    "skills/b-skill/SKILL.md": _skill_file("b-skill"),
    "skills/b-skill/scripts/run.py": b"print()",
}


@dataclass
class FakeGitHub:
    """A mock GitHub API serving one repository at one commit."""

    tarball: bytes
    sha: str = SHA
    refs: dict[str, str] = field(default_factory=dict)
    offline: bool = False
    requests: list[httpx.Request] = field(default_factory=list)

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.offline:
            raise httpx.ConnectError("no route to host", request=request)
        parts = request.url.path.strip("/").split("/")
        assert parts[:3] == ["repos", "acme", "skills"], request.url
        if parts[3] == "commits":
            ref = unquote(parts[4])
            sha = self.refs.get(ref)
            if sha is None:
                return httpx.Response(404, json={"message": "No commit found"})
            return httpx.Response(200, json={"sha": sha})
        if parts[3] == "tarball":
            if parts[4] != self.sha:
                return httpx.Response(404)
            return httpx.Response(200, content=self.tarball)
        return httpx.Response(404)

    @property
    def calls(self) -> list[str]:
        return [f"{r.method} {unquote(r.url.path)}" for r in self.requests]

    def client(self) -> httpx.Client:
        return httpx.Client(
            base_url="https://api.github.test", transport=httpx.MockTransport(self.handler)
        )


@pytest.fixture
def github() -> Iterator[FakeGitHub]:
    fake = FakeGitHub(tarball=_tarball(COLLECTION), refs={"HEAD": SHA, "main": SHA, "v1": SHA})
    yield fake


class TestParse:
    @pytest.mark.parametrize(
        "entry, expected",
        [
            pytest.param(
                "github:acme/skills",
                GitHubSkillSource("acme", "skills"),
                id="repo-root-default-branch",
            ),
            pytest.param(
                "github:acme/skills@main",
                GitHubSkillSource("acme", "skills", ref="main"),
                id="branch",
            ),
            pytest.param(
                "github:acme/skills@feature/x@y",
                GitHubSkillSource("acme", "skills", ref="feature/x@y"),
                id="branch-with-slash-and-at",
            ),
            pytest.param(
                f"github:acme/skills@{SHA}",
                GitHubSkillSource("acme", "skills", ref=SHA),
                id="commit",
            ),
            pytest.param(
                "github:acme/skills/skills/triage@v1.4.0",
                GitHubSkillSource("acme", "skills", path="skills/triage", ref="v1.4.0"),
                id="path-and-tag",
            ),
            pytest.param(
                "github:acme/skills/skills/",
                GitHubSkillSource("acme", "skills", path="skills"),
                id="trailing-slash",
            ),
            pytest.param(
                "github:acme/my.skills_v2",
                GitHubSkillSource("acme", "my.skills_v2"),
                id="repo-punctuation",
            ),
        ],
    )
    def test_accepted_forms(self, entry: str, expected: GitHubSkillSource) -> None:
        assert GitHubSkillSource.parse(entry) == expected

    def test_str_round_trips(self) -> None:
        for entry in [
            "github:acme/skills",
            "github:acme/skills@main",
            "github:acme/skills/skills/triage@v1.4.0",
        ]:
            assert str(GitHubSkillSource.parse(entry)) == entry

    def test_a_full_sha_pins_a_commit(self) -> None:
        assert GitHubSkillSource.parse(f"github:acme/skills@{SHA}").pins_a_commit
        assert not GitHubSkillSource.parse("github:acme/skills@main").pins_a_commit
        assert not GitHubSkillSource.parse(f"github:acme/skills@{SHA[:12]}").pins_a_commit

    @pytest.mark.parametrize(
        "entry, message",
        [
            pytest.param("gh:acme/skills", "is not a github: skills source", id="wrong-scheme"),
            pytest.param("github:acme", "expected github:owner/repo", id="no-repo"),
            pytest.param("github:", "expected github:owner/repo", id="empty"),
            pytest.param("github:acme//skills", "expected github:owner/repo", id="empty-segment"),
            pytest.param("github:acme/skills@", "ref after '@' is empty", id="empty-ref"),
            pytest.param("github:acme/skills@-x", "may not start with '-'", id="dash-ref"),
            pytest.param("github:-acme/skills", "not a valid GitHub owner", id="bad-owner"),
            pytest.param("github:acme/sk ills", "not a valid GitHub repository", id="bad-repo"),
            pytest.param(
                "github:acme/../skills", "not a valid GitHub repository", id="dotdot-repo"
            ),
            pytest.param("github:acme/skills/../etc", "'.' or '..' segments", id="dotdot-path"),
        ],
    )
    def test_rejected_forms(self, entry: str, message: str) -> None:
        with pytest.raises(ValueError, match=message):
            GitHubSkillSource.parse(entry)


class TestMaterialize:
    def test_a_repository_root_is_a_directory_named_after_the_repository(
        self, github: FakeGitHub, tmp_path: Path
    ) -> None:
        source = GitHubSkillSource.parse("github:acme/skills@main")

        root = materialize_github_source(source, cache_dir=tmp_path, client=github.client())

        assert root == tmp_path / "github" / "acme" / "skills" / SHA / "skills"
        assert root.name == "skills"
        assert (root / "README.md").read_text() == "about"
        assert github.calls == [
            "GET /repos/acme/skills/commits/main",
            "GET /repos/acme/skills/tarball/" + SHA,
        ]

    def test_a_path_keeps_its_last_segment_as_the_directory_name(
        self, github: FakeGitHub, tmp_path: Path
    ) -> None:
        source = GitHubSkillSource.parse("github:acme/skills/skills/a-skill@v1")

        root = materialize_github_source(source, cache_dir=tmp_path, client=github.client())

        assert root.name == "a-skill"
        skills = load_skills((root,))
        assert [skill.name for skill in skills] == ["a-skill"]
        assert [r.name for r in skills[0].references] == [
            "references/deep/more.md",
            "references/guide.md",
        ]
        assert skills[0].references[1].read() == "guide"

    def test_a_directory_of_skills_loads_them_all_with_references(
        self, github: FakeGitHub, tmp_path: Path
    ) -> None:
        root = materialize_github_source(
            GitHubSkillSource.parse("github:acme/skills/skills"),
            cache_dir=tmp_path,
            client=github.client(),
        )

        assert [skill.name for skill in load_skills((root,))] == ["a-skill", "b-skill"]
        assert github.calls[0] == "GET /repos/acme/skills/commits/HEAD"

    def test_unsafe_archive_members_are_never_written(
        self, github: FakeGitHub, tmp_path: Path
    ) -> None:
        materialize_github_source(
            GitHubSkillSource.parse("github:acme/skills"),
            cache_dir=tmp_path,
            client=github.client(),
        )

        written = sorted(p.relative_to(tmp_path).as_posix() for p in tmp_path.rglob("*"))
        assert not any(
            "escaped.md" in p or "absolute.md" in p or "link-to-etc" in p for p in written
        )
        assert not any(p.is_symlink() for p in tmp_path.rglob("*"))
        assert (tmp_path / "github" / "acme" / "skills" / SHA / "skills" / "README.md").is_file()

    def test_a_pinned_commit_is_fetched_once_and_then_served_from_cache(
        self, github: FakeGitHub, tmp_path: Path
    ) -> None:
        source = GitHubSkillSource.parse(f"github:acme/skills/skills@{SHA}")

        first = materialize_github_source(source, cache_dir=tmp_path, client=github.client())
        assert github.calls == ["GET /repos/acme/skills/tarball/" + SHA]

        github.offline = True
        second = materialize_github_source(source, cache_dir=tmp_path, client=github.client())

        assert second == first
        assert len(github.requests) == 1

    def test_two_paths_in_one_commit_share_a_download(
        self, github: FakeGitHub, tmp_path: Path
    ) -> None:
        client = github.client()
        a = materialize_github_source(
            GitHubSkillSource.parse("github:acme/skills/skills/a-skill@main"),
            cache_dir=tmp_path,
            client=client,
        )
        b = materialize_github_source(
            GitHubSkillSource.parse("github:acme/skills/skills/b-skill@main"),
            cache_dir=tmp_path,
            client=client,
        )

        assert a.parent == b.parent
        assert github.calls.count("GET /repos/acme/skills/tarball/" + SHA) == 1

    def test_a_branch_is_re_resolved_and_a_moved_branch_is_re_fetched(
        self, github: FakeGitHub, tmp_path: Path
    ) -> None:
        source = GitHubSkillSource.parse("github:acme/skills@main")
        materialize_github_source(source, cache_dir=tmp_path, client=github.client())

        github.refs["main"] = OTHER_SHA
        github.sha = OTHER_SHA
        github.tarball = _tarball({"MOVED.md": b"moved"})
        root = materialize_github_source(source, cache_dir=tmp_path, client=github.client())

        assert root == tmp_path / "github" / "acme" / "skills" / OTHER_SHA / "skills"
        assert (root / "MOVED.md").is_file()
        assert github.calls.count("GET /repos/acme/skills/commits/main") == 2

    def test_an_unreachable_github_falls_back_to_the_last_resolved_commit(
        self, github: FakeGitHub, tmp_path: Path, caplog: pytest.LogCaptureFixture
    ) -> None:
        source = GitHubSkillSource.parse("github:acme/skills@main")
        first = materialize_github_source(source, cache_dir=tmp_path, client=github.client())

        github.offline = True
        with caplog.at_level(logging.WARNING, logger="phoenix.server.mcp.skills.github"):
            second = materialize_github_source(source, cache_dir=tmp_path, client=github.client())

        assert second == first
        assert any(
            "Could not resolve github:acme/skills@main" in record.message
            and SHA[:12] in record.message
            for record in caplog.records
        )

    def test_an_unreachable_github_with_nothing_cached_fails_the_start(
        self, github: FakeGitHub, tmp_path: Path
    ) -> None:
        github.offline = True
        with pytest.raises(
            ValueError, match="github:acme/skills@main: could not resolve ref 'main'"
        ):
            materialize_github_source(
                GitHubSkillSource.parse("github:acme/skills@main"),
                cache_dir=tmp_path,
                client=github.client(),
            )
        with pytest.raises(ValueError, match="could not download commit"):
            materialize_github_source(
                GitHubSkillSource.parse(f"github:acme/skills@{SHA}"),
                cache_dir=tmp_path,
                client=github.client(),
            )
        assert not (tmp_path / "github" / "acme" / "skills" / SHA).exists()

    def test_an_unknown_ref_is_refused(self, github: FakeGitHub, tmp_path: Path) -> None:
        with pytest.raises(ValueError, match="could not resolve ref 'nope'"):
            materialize_github_source(
                GitHubSkillSource.parse("github:acme/skills@nope"),
                cache_dir=tmp_path,
                client=github.client(),
            )

    def test_a_path_missing_from_the_repository_is_refused(
        self, github: FakeGitHub, tmp_path: Path
    ) -> None:
        with pytest.raises(ValueError, match="'skills/nope' is not a directory in acme/skills"):
            materialize_github_source(
                GitHubSkillSource.parse("github:acme/skills/skills/nope"),
                cache_dir=tmp_path,
                client=github.client(),
            )

    def test_a_path_to_a_file_is_refused(self, github: FakeGitHub, tmp_path: Path) -> None:
        with pytest.raises(ValueError, match="'README.md' is not a directory"):
            materialize_github_source(
                GitHubSkillSource.parse("github:acme/skills/README.md"),
                cache_dir=tmp_path,
                client=github.client(),
            )

    def test_a_partial_download_leaves_no_cache_entry(
        self, github: FakeGitHub, tmp_path: Path
    ) -> None:
        github.tarball = b"not a tarball"
        with pytest.raises(tarfile.ReadError):
            materialize_github_source(
                GitHubSkillSource.parse(f"github:acme/skills@{SHA}"),
                cache_dir=tmp_path,
                client=github.client(),
            )
        commit_dir = tmp_path / "github" / "acme" / "skills"
        assert not (commit_dir / SHA).exists()
        assert not any(commit_dir.iterdir()) if commit_dir.exists() else True


class TestConfiguredSources:
    def test_local_paths_and_github_sources_mix_in_order(
        self, github: FakeGitHub, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        local = tmp_path / "local" / "local-skill"
        local.mkdir(parents=True)
        (local / "SKILL.md").write_bytes(_skill_file("local-skill"))
        monkeypatch.chdir(tmp_path)

        roots = resolve_skill_roots(
            ["./local", "github:acme/skills/skills@main"],
            cache_dir=tmp_path / "cache",
            client=github.client(),
        )

        assert roots == (
            (tmp_path / "local").resolve(),
            tmp_path / "cache" / "github" / "acme" / "skills" / SHA / "skills" / "skills",
        )
        assert [skill.name for skill in load_skills(roots)] == ["local-skill", "a-skill", "b-skill"]

    def test_load_external_skills_reads_github_entries(
        self, github: FakeGitHub, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("PHOENIX_WORKING_DIR", str(tmp_path / "work"))
        monkeypatch.setenv("PHOENIX_SKILLS_PATHS", "github:acme/skills/skills/a-skill@v1")
        monkeypatch.setattr(
            "phoenix.server.mcp.skills.github.create_github_client", lambda token: github.client()
        )

        skills = load_external_skills()

        assert [skill.name for skill in skills] == ["a-skill"]
        assert (tmp_path / "work" / "skills" / "github" / "acme" / "skills" / SHA).is_dir()

    def test_local_only_configuration_touches_no_cache(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        local = tmp_path / "local-skill"
        local.mkdir()
        (local / "SKILL.md").write_bytes(_skill_file("local-skill"))
        monkeypatch.setenv("PHOENIX_WORKING_DIR", str(tmp_path / "work"))
        monkeypatch.setenv("PHOENIX_SKILLS_PATHS", str(local))

        assert [skill.name for skill in load_external_skills()] == ["local-skill"]
        assert not (tmp_path / "work").exists()

    def test_the_token_is_sent_as_a_bearer_header(
        self, github: FakeGitHub, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from phoenix.server.mcp.skills.github import create_github_client

        client = create_github_client("ghp_secret")
        assert client.headers["Authorization"] == "Bearer ghp_secret"
        assert client.headers["Accept"] == "application/vnd.github+json"
        assert "Authorization" not in create_github_client(None).headers
        client.close()
