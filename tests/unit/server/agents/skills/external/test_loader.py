from __future__ import annotations

from pathlib import Path

import pytest

from phoenix.server.agents.skills.external import SkillDiagnosticCode, load_external_skills

from .conftest import write_skill


class TestUnset:
    def test_no_setting_is_a_clean_no_op(self, tmp_path: Path) -> None:
        """The default deployment must be untouched by this feature."""
        result = load_external_skills(sources_setting=None, cache_dir=tmp_path)

        assert result.skills == []
        assert result.diagnostics == []

    def test_empty_setting_is_a_clean_no_op(self, tmp_path: Path) -> None:
        result = load_external_skills(sources_setting="  ", cache_dir=tmp_path)

        assert result.skills == []
        assert result.diagnostics == []


class TestLocalSources:
    def test_loads_skills_from_a_local_directory(self, tmp_path: Path, source_root: Path) -> None:
        write_skill(source_root, directory="external-one")
        write_skill(source_root, directory="external-two")

        result = load_external_skills(sources_setting=str(source_root), cache_dir=tmp_path)

        assert result.names == {"external-one", "external-two"}

    def test_loads_from_several_directories(self, tmp_path: Path) -> None:
        first = tmp_path / "first"
        second = tmp_path / "second"
        first.mkdir()
        second.mkdir()
        write_skill(first, directory="from-first")
        write_skill(second, directory="from-second")

        result = load_external_skills(
            sources_setting=f"{first},{second}", cache_dir=tmp_path / "cache"
        )

        assert result.names == {"from-first", "from-second"}

    def test_a_missing_directory_does_not_prevent_the_others(self, tmp_path: Path) -> None:
        present = tmp_path / "present"
        present.mkdir()
        write_skill(present, directory="real")

        result = load_external_skills(
            sources_setting=f"{tmp_path / 'absent'},{present}", cache_dir=tmp_path / "cache"
        )

        assert result.names == {"real"}
        assert SkillDiagnosticCode.SOURCE_MISSING in {d.code for d in result.diagnostics}

    def test_an_unparseable_source_is_reported_not_raised(self, tmp_path: Path) -> None:
        """A typo in the setting must not stop the server from starting."""
        result = load_external_skills(sources_setting="not a source", cache_dir=tmp_path)

        assert result.skills == []
        assert [d.code for d in result.diagnostics] == [SkillDiagnosticCode.SOURCE_MISSING]


class TestCollisions:
    def test_a_built_in_name_cannot_be_shadowed(self, tmp_path: Path, source_root: Path) -> None:
        """Two mounts cannot share `/skills/<name>`, so first-party has to win."""
        write_skill(source_root, directory="phoenix-graphql")
        write_skill(source_root, directory="genuinely-external")

        result = load_external_skills(
            sources_setting=str(source_root),
            cache_dir=tmp_path,
            reserved_names=["phoenix-graphql", "span-coding"],
        )

        assert result.names == {"genuinely-external"}
        collisions = [d for d in result.diagnostics if d.code is SkillDiagnosticCode.NAME_COLLISION]
        assert [d.skill_name for d in collisions] == ["phoenix-graphql"]

    def test_the_earlier_source_wins_between_two_external_sources(self, tmp_path: Path) -> None:
        first = tmp_path / "first"
        second = tmp_path / "second"
        first.mkdir()
        second.mkdir()
        write_skill(first, directory="shared", body="FROM FIRST")
        write_skill(second, directory="shared", body="FROM SECOND")

        result = load_external_skills(
            sources_setting=f"{first},{second}", cache_dir=tmp_path / "cache"
        )

        assert [skill.content for skill in result.skills] == ["FROM FIRST"]
        assert SkillDiagnosticCode.NAME_COLLISION in {d.code for d in result.diagnostics}

    def test_reserving_nothing_allows_any_name(self, tmp_path: Path, source_root: Path) -> None:
        write_skill(source_root, directory="phoenix-graphql")

        result = load_external_skills(sources_setting=str(source_root), cache_dir=tmp_path)

        assert result.names == {"phoenix-graphql"}


class TestNoNetwork:
    def test_an_unreachable_remote_does_not_stop_local_sources(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """No network reachable ⇒ the server still starts with whatever it can load."""
        import phoenix.server.agents.skills.external.fetch as fetch_module

        def explode(*args: object, **kwargs: object) -> None:
            raise OSError("network unreachable")

        monkeypatch.setattr(fetch_module, "_download", explode)

        local = tmp_path / "local"
        local.mkdir()
        write_skill(local, directory="local-skill")

        result = load_external_skills(
            sources_setting=f"owner/repo,{local}", cache_dir=tmp_path / "cache"
        )

        assert result.names == {"local-skill"}
        assert SkillDiagnosticCode.FETCH_FAILED in {d.code for d in result.diagnostics}
