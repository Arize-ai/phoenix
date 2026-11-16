import tempfile
import unittest
from pathlib import Path

from sync_skills import _mark_internal, _metadata


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


if __name__ == "__main__":
    unittest.main()
