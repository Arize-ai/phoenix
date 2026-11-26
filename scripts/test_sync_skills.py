import filecmp
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import sync_skills
from sync_skills import _mark_internal, _metadata, file_copies


class TestMarkInternal(unittest.TestCase):
    def test_marks_internal_without_duplicate_keys(self) -> None:
        for metadata in (
            "",
            "metadata:\n  author: Phoenix\n",
            "metadata:\n  author: Phoenix\n  internal: false\n",
            "metadata:\n  author: Phoenix\n  internal: true\n",
        ):
            with self.subTest(metadata=metadata), tempfile.TemporaryDirectory() as directory:
                skill_file = Path(directory) / "SKILL.md"
                skill_file.write_text(
                    "---\nname: contributor\n"
                    + metadata
                    + "description: A contributor skill\n---\nSkill instructions.\n",
                    encoding="utf-8",
                )

                _mark_internal(skill_file)()

                marked = skill_file.read_text(encoding="utf-8")
                top, fields = _metadata(skill_file)
                self.assertEqual(fields["internal"], "true")
                self.assertEqual(marked.count("internal:"), 1)
                self.assertEqual(top["description"], "A contributor skill")
                self.assertTrue(marked.endswith("---\nSkill instructions.\n"))
                if "author:" in metadata:
                    self.assertEqual(fields["author"], "Phoenix")

                _mark_internal(skill_file)()

                self.assertEqual(skill_file.read_text(encoding="utf-8"), marked)


class TestFileCopies(unittest.TestCase):
    def setUp(self) -> None:
        temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(temporary_directory.cleanup)
        self.root = Path(temporary_directory.name)
        repo_root_patch = mock.patch.object(sync_skills, "REPO_ROOT", self.root)
        repo_root_patch.start()
        self.addCleanup(repo_root_patch.stop)
        self.source = self.root / "skills" / "references" / "filter-expressions.md"
        self.source.parent.mkdir(parents=True)
        self.source.write_text("# Filter expressions\n", encoding="utf-8")
        self.dest = self.root / "pxi" / "references" / "filter-expressions.md"

    def list_changes(self) -> tuple[list[sync_skills.Change], list[str]]:
        errors: list[str] = []
        changes = list(file_copies([(self.source, self.dest)], errors))
        return changes, errors

    def test_writes_missing_copy(self) -> None:
        changes, errors = self.list_changes()

        self.assertEqual(errors, [])
        self.assertEqual(len(changes), 1)
        changes[0].apply()
        self.assertTrue(filecmp.cmp(self.source, self.dest, shallow=False))
        self.assertEqual(self.list_changes(), ([], []))

    def test_reports_and_fixes_drifted_copy(self) -> None:
        self.dest.parent.mkdir(parents=True)
        self.dest.write_text("# Filter expressions\nEdited by hand.\n", encoding="utf-8")

        changes, errors = self.list_changes()

        self.assertEqual(errors, [])
        self.assertEqual(
            [change.message for change in changes],
            [
                "pxi/references/filter-expressions.md: copy from "
                "skills/references/filter-expressions.md"
            ],
        )
        changes[0].apply()
        self.assertEqual(self.dest.read_text(encoding="utf-8"), "# Filter expressions\n")

    def test_reports_missing_source(self) -> None:
        self.source.unlink()

        changes, errors = self.list_changes()

        self.assertEqual(changes, [])
        self.assertEqual(len(errors), 1)
        self.assertIn("skills/references/filter-expressions.md: missing", errors[0])


if __name__ == "__main__":
    unittest.main()
