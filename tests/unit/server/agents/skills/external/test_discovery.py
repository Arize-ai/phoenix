from __future__ import annotations

from pathlib import Path

from phoenix.server.agents.skills.external import (
    SkillDiagnosticCode,
    discover_skills_in_directory,
)
from phoenix.server.agents.skills.external.validation import (
    BODY_MAX_BYTES,
    DESCRIPTION_MAX_CHARS,
)

from .conftest import write_skill


def _codes(result: object) -> list[SkillDiagnosticCode]:
    return [diagnostic.code for diagnostic in result.diagnostics]  # type: ignore[attr-defined]


class TestValidSkills:
    def test_loads_a_valid_skill(self, source_root: Path) -> None:
        write_skill(source_root, directory="demo-skill")

        result = discover_skills_in_directory(source_root, source="test")

        assert [skill.name for skill in result.skills] == ["demo-skill"]
        assert result.diagnostics == []

    def test_loads_several_skills_in_directory_order(self, source_root: Path) -> None:
        write_skill(source_root, directory="zeta")
        write_skill(source_root, directory="alpha")

        result = discover_skills_in_directory(source_root, source="test")

        assert [skill.name for skill in result.skills] == ["alpha", "zeta"]

    def test_a_root_that_is_itself_a_skill(self, tmp_path: Path) -> None:
        """A source pointing straight at one skill, rather than a directory of them."""
        skill_dir = write_skill(tmp_path, directory="solo")

        result = discover_skills_in_directory(skill_dir, source="test")

        assert [skill.name for skill in result.skills] == ["solo"]
        assert result.diagnostics == []

    def test_skill_path_is_the_directory_so_it_can_be_mounted(self, source_root: Path) -> None:
        skill_dir = write_skill(source_root, directory="demo-skill")

        result = discover_skills_in_directory(source_root, source="test")

        assert result.skills[0].path == skill_dir.resolve()

    def test_directories_without_a_skill_md_are_ignored_silently(self, source_root: Path) -> None:
        (source_root / "not-a-skill").mkdir()
        (source_root / "not-a-skill" / "README.md").write_text("hi", encoding="utf-8")
        write_skill(source_root, directory="real")

        result = discover_skills_in_directory(source_root, source="test")

        assert [skill.name for skill in result.skills] == ["real"]
        assert result.diagnostics == []


class TestOptionalSummary:
    def test_a_skill_without_summary_still_loads(self, source_root: Path) -> None:
        """`summary` is not in the Agent Skills spec, so requiring it would reject
        essentially every third-party skill."""
        write_skill(source_root, directory="no-summary", summary=None)

        result = discover_skills_in_directory(source_root, source="test")

        assert [skill.name for skill in result.skills] == ["no-summary"]
        assert result.diagnostics == []

    def test_an_absent_summary_stays_absent(self, source_root: Path) -> None:
        """Only the browser slash-menu reads it, and external skills never reach that."""
        write_skill(source_root, directory="no-summary", summary=None)

        result = discover_skills_in_directory(source_root, source="test")

        assert result.skills[0].summary is None


class TestRejections:
    def test_an_invalid_name_is_skipped(self, source_root: Path) -> None:
        write_skill(source_root, directory="Bad_Name", name="Bad_Name")

        result = discover_skills_in_directory(source_root, source="test")

        assert result.skills == []
        assert _codes(result) == [SkillDiagnosticCode.INVALID_NAME]

    def test_consecutive_hyphens_are_rejected(self, source_root: Path) -> None:
        write_skill(source_root, directory="bad--name", name="bad--name")

        result = discover_skills_in_directory(source_root, source="test")

        assert result.skills == []
        assert _codes(result) == [SkillDiagnosticCode.INVALID_NAME]

    def test_a_name_not_matching_its_directory_is_skipped(self, source_root: Path) -> None:
        """The name becomes the mount directory, so a mismatch would break the skill's
        own relative resource links."""
        write_skill(source_root, directory="on-disk", name="in-frontmatter")

        result = discover_skills_in_directory(source_root, source="test")

        assert result.skills == []
        assert _codes(result) == [SkillDiagnosticCode.NAME_MISMATCH]

    def test_a_missing_name_is_skipped(self, source_root: Path) -> None:
        write_skill(source_root, directory="nameless", name=None)

        result = discover_skills_in_directory(source_root, source="test")

        assert result.skills == []
        assert _codes(result) == [SkillDiagnosticCode.INVALID_NAME]

    def test_an_empty_description_is_skipped(self, source_root: Path) -> None:
        write_skill(source_root, directory="blank", description=None)

        result = discover_skills_in_directory(source_root, source="test")

        assert result.skills == []
        assert _codes(result) == [SkillDiagnosticCode.INVALID_DESCRIPTION]

    def test_an_oversized_description_is_skipped(self, source_root: Path) -> None:
        write_skill(source_root, directory="verbose", description="x" * (DESCRIPTION_MAX_CHARS + 1))

        result = discover_skills_in_directory(source_root, source="test")

        assert result.skills == []
        assert _codes(result) == [SkillDiagnosticCode.INVALID_DESCRIPTION]

    def test_an_oversized_body_is_skipped(self, source_root: Path) -> None:
        """The model reads the body with `cat`, so nothing downstream truncates it."""
        write_skill(source_root, directory="huge", body="x" * (BODY_MAX_BYTES + 1))

        result = discover_skills_in_directory(source_root, source="test")

        assert result.skills == []
        assert _codes(result) == [SkillDiagnosticCode.TOO_LARGE]

    def test_malformed_yaml_is_skipped(self, source_root: Path) -> None:
        skill_dir = source_root / "broken"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text("---\nname: [unclosed\n---\n\nbody\n", encoding="utf-8")

        result = discover_skills_in_directory(source_root, source="test")

        assert result.skills == []
        assert _codes(result) == [SkillDiagnosticCode.MALFORMED]

    def test_a_missing_frontmatter_fence_is_skipped(self, source_root: Path) -> None:
        skill_dir = source_root / "fenceless"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text("# Just markdown\n", encoding="utf-8")

        result = discover_skills_in_directory(source_root, source="test")

        assert result.skills == []
        assert _codes(result) == [SkillDiagnosticCode.MALFORMED]

    def test_one_bad_skill_does_not_stop_the_others(self, source_root: Path) -> None:
        """Failure isolation is the whole point: startup must survive a bad directory."""
        write_skill(source_root, directory="good-one")
        write_skill(source_root, directory="Bad_Name", name="Bad_Name")
        write_skill(source_root, directory="good-two")

        result = discover_skills_in_directory(source_root, source="test")

        assert [skill.name for skill in result.skills] == ["good-one", "good-two"]
        assert _codes(result) == [SkillDiagnosticCode.INVALID_NAME]


class TestUnsafePaths:
    def test_a_symlink_escaping_the_root_is_skipped(
        self, source_root: Path, tmp_path: Path
    ) -> None:
        outside = tmp_path / "outside"
        outside.mkdir()
        (outside / "SKILL.md").write_text(
            "---\nname: escaped\ndescription: d\n---\n\nbody\n", encoding="utf-8"
        )
        escaping = source_root / "escaped"
        escaping.mkdir()
        (escaping / "SKILL.md").symlink_to(outside / "SKILL.md")

        result = discover_skills_in_directory(source_root, source="test")

        assert result.skills == []
        assert _codes(result) == [SkillDiagnosticCode.UNSAFE_PATH]

    def test_a_symlink_within_the_root_is_allowed(self, source_root: Path) -> None:
        real = write_skill(source_root, directory="real-skill")
        linked = source_root / "linked-skill"
        linked.mkdir()
        (linked / "SKILL.md").symlink_to(real / "SKILL.md")

        result = discover_skills_in_directory(source_root, source="test")

        # The link resolves inside the root, so it is read — and then rejected only
        # because the resolved skill's name does not match `linked-skill`.
        assert [skill.name for skill in result.skills] == ["real-skill"]
        assert _codes(result) == [SkillDiagnosticCode.NAME_MISMATCH]


class TestMissingSource:
    def test_a_missing_directory_is_a_diagnostic_not_an_error(self, tmp_path: Path) -> None:
        result = discover_skills_in_directory(tmp_path / "nope", source="test")

        assert result.skills == []
        assert _codes(result) == [SkillDiagnosticCode.SOURCE_MISSING]


class TestUnsupportedFields:
    def test_allowed_tools_is_reported_as_ignored(self, source_root: Path) -> None:
        """Phoenix has no per-skill tool gating, so silence would mislead the author."""
        write_skill(
            source_root,
            directory="gated",
            extra_frontmatter="allowed-tools: [bash]",
        )

        result = discover_skills_in_directory(source_root, source="test")

        assert [skill.name for skill in result.skills] == ["gated"]
        assert _codes(result) == [SkillDiagnosticCode.IGNORED_FIELD]


class TestRootAsSkill:
    def test_root_name_is_not_matched_against_the_skill_name(self, tmp_path: Path) -> None:
        """A remote root is the cache directory, named for the repo — not the skill."""
        root = tmp_path / "owner-some-repo"
        write_skill(root.parent, directory=root.name, name="total-recall")

        result = discover_skills_in_directory(root, source="test")

        assert [skill.name for skill in result.skills] == ["total-recall"]
        assert result.diagnostics == []

    def test_child_directories_still_must_match(self, source_root: Path) -> None:
        write_skill(source_root, directory="on-disk", name="in-frontmatter")

        result = discover_skills_in_directory(source_root, source="test")

        assert result.skills == []
        assert _codes(result) == [SkillDiagnosticCode.NAME_MISMATCH]
