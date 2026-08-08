from __future__ import annotations

from pathlib import Path

import pytest

from phoenix.server.agents.skills.external import (
    LocalSkillSource,
    RemoteSkillSource,
    SkillSourceError,
    parse_skill_sources,
)


class TestEmpty:
    @pytest.mark.parametrize("value", [None, "", "   ", ",", " , "])
    def test_no_sources(self, value: str | None) -> None:
        """Unset must be exactly today's behavior."""
        assert parse_skill_sources(value) == []


class TestLocal:
    @pytest.mark.parametrize(
        ("value", "expected"),
        [
            ("/etc/phoenix/skills", "/etc/phoenix/skills"),
            ("./skills", "skills"),
            ("../skills", "../skills"),
            ("file:///srv/skills", "/srv/skills"),
        ],
    )
    def test_directory_forms(self, value: str, expected: str) -> None:
        (source,) = parse_skill_sources(value)

        assert isinstance(source, LocalSkillSource)
        assert source.path == Path(expected)

    def test_tilde_is_expanded(self) -> None:
        (source,) = parse_skill_sources("~/skills")

        assert isinstance(source, LocalSkillSource)
        assert not str(source.path).startswith("~")


class TestRemote:
    @pytest.mark.parametrize(
        "value",
        [
            "https://github.com/owner/repo",
            "https://github.com/owner/repo.git",
            "owner/repo",
        ],
    )
    def test_unpinned_forms(self, value: str) -> None:
        (source,) = parse_skill_sources(value)

        assert isinstance(source, RemoteSkillSource)
        assert (source.owner, source.repo, source.ref) == ("owner", "repo", None)

    @pytest.mark.parametrize(
        "value",
        ["https://github.com/owner/repo@v1.2.0", "owner/repo@v1.2.0"],
    )
    def test_pinned_forms(self, value: str) -> None:
        (source,) = parse_skill_sources(value)

        assert isinstance(source, RemoteSkillSource)
        assert source.ref == "v1.2.0"

    def test_a_scheme_is_not_mistaken_for_a_pin(self) -> None:
        """Splitting on the first `@` would take the ref from inside the URL."""
        (source,) = parse_skill_sources("https://github.com/owner/repo")

        assert isinstance(source, RemoteSkillSource)
        assert source.ref is None

    def test_a_sha_ref_is_kept(self) -> None:
        (source,) = parse_skill_sources("owner/repo@0123456789abcdef")

        assert isinstance(source, RemoteSkillSource)
        assert source.ref == "0123456789abcdef"

    def test_cache_key_distinguishes_refs(self) -> None:
        """Two pins of one repo must not share a cache directory."""
        (pinned,) = parse_skill_sources("owner/repo@v1")
        (other,) = parse_skill_sources("owner/repo@v2")
        (unpinned,) = parse_skill_sources("owner/repo")

        assert len({pinned.cache_key, other.cache_key, unpinned.cache_key}) == 3  # type: ignore[union-attr]

    def test_cache_key_is_filesystem_safe(self) -> None:
        (source,) = parse_skill_sources("owner/repo@feature/branch")

        assert "/" not in source.cache_key  # type: ignore[union-attr]


class TestRejections:
    @pytest.mark.parametrize(
        "value",
        [
            "not a source",
            "https://gitlab.com/owner/repo",
            "https://github.com/owner",
            "owner/repo/extra",
        ],
    )
    def test_unrecognized_entries_raise(self, value: str) -> None:
        with pytest.raises(SkillSourceError):
            parse_skill_sources(value)


class TestMultiple:
    def test_mixed_sources_keep_configured_order(self) -> None:
        sources = parse_skill_sources("/local/one, owner/repo@v1 ,/local/two")

        assert [type(source).__name__ for source in sources] == [
            "LocalSkillSource",
            "RemoteSkillSource",
            "LocalSkillSource",
        ]
        assert isinstance(sources[2], LocalSkillSource)
        assert sources[2].path == Path("/local/two")


class TestSubdirectory:
    """GitHub "tree" URLs, which is what browsing to a folder gives you."""

    def test_tree_url_carries_ref_and_subdirectory(self) -> None:
        (source,) = parse_skill_sources("https://github.com/anthropics/skills/tree/main/skills")

        assert isinstance(source, RemoteSkillSource)
        assert (source.owner, source.repo) == ("anthropics", "skills")
        assert source.ref == "main"
        assert source.subdirectory == "skills"

    def test_nested_subdirectory(self) -> None:
        (source,) = parse_skill_sources("https://github.com/owner/repo/tree/v1/a/b/c")

        assert isinstance(source, RemoteSkillSource)
        assert source.subdirectory == "a/b/c"

    def test_plain_repo_url_has_no_subdirectory(self) -> None:
        (source,) = parse_skill_sources("https://github.com/owner/repo")

        assert isinstance(source, RemoteSkillSource)
        assert source.subdirectory is None

    def test_two_pins_of_one_repo_share_a_cache(self) -> None:
        """The subdirectory selects within the archive; it does not change what is fetched."""
        (root,) = parse_skill_sources("https://github.com/owner/repo/tree/main")
        (nested,) = parse_skill_sources("https://github.com/owner/repo/tree/main/skills")

        assert root.cache_key == nested.cache_key  # type: ignore[union-attr]

    @pytest.mark.parametrize(
        "value",
        [
            "https://github.com/owner/repo/blob/main/SKILL.md",
            "https://github.com/owner/repo/tree",
        ],
    )
    def test_unrecognized_repo_paths_raise(self, value: str) -> None:
        with pytest.raises(SkillSourceError):
            parse_skill_sources(value)
