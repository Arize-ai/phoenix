"""Tests for the release-bookkeeping detector.

Run by a path-filtered CI job when the detector changes. The detector fails
open, so these guard the optimization rather than the correctness of any PR.
"""

from __future__ import annotations

import contextlib
import io
import os
import tempfile
import unittest
from unittest import mock

from bookkeeping_only import (
    MAX_FILES,
    PACKAGE_CHANGELOG,
    NotBookkeeping,
    classify,
    decide,
    hunks,
    patch_of,
    released_versions,
)

ROOT_BUMP = {".": ("20.3.0", "20.4.0")}
CLIENT_BUMP = {"packages/phoenix-client": ("3.1.0", "3.2.0")}

MANIFEST_ENTRY = {"filename": ".release-please-manifest.json", "status": "modified", "patch": ""}

VERSION_PY_PATCH = '@@ -1 +1 @@\n-__version__ = "20.3.0"\n+__version__ = "20.4.0"'

PYPROJECT_PATCH = """@@ -21,7 +21,7 @@ classifiers = [
   "Programming Language :: Python :: 3.13",
 ]
-version = "3.1.0"
+version = "3.2.0"
 dependencies = [
   "httpx","""

LOCK_PATCH = (
    "@@ -885,7 +885,7 @@ dev = [\n"
    " \n"
    " [[package]]\n"
    ' name = "arize-phoenix-client"\n'
    '-version = "3.1.0"\n'
    '+version = "3.2.0"\n'
    ' source = { editable = "packages/phoenix-client" }\n'
    " dependencies = [\n"
    '     { name = "httpx" },'
)

CHANGELOG_PATCH = (
    "@@ -1,5 +1,12 @@\n"
    " # Changelog\n"
    " \n"
    "+## [3.2.0](https://example.invalid) (2026-08-14)\n"
    "+\n"
    " ## [3.1.0](https://example.invalid) (2026-08-11)"
)


def entry(filename: str, patch: str, status: str = "modified") -> dict[str, object]:
    return {"filename": filename, "status": status, "patch": patch}


def refuses(test: unittest.TestCase, files: list[dict[str, object]], bumps: dict) -> None:
    with test.assertRaises(NotBookkeeping):
        classify(files, bumps)


class ReleaseShapes(unittest.TestCase):
    """The real diffs release-please produces must be recognised."""

    def test_root_release(self) -> None:
        classify(
            [
                MANIFEST_ENTRY,
                entry("CHANGELOG.md", CHANGELOG_PATCH),
                entry("src/phoenix/version.py", VERSION_PY_PATCH),
            ],
            ROOT_BUMP,
        )

    def test_sibling_release(self) -> None:
        classify(
            [
                MANIFEST_ENTRY,
                entry("packages/phoenix-client/CHANGELOG.md", CHANGELOG_PATCH),
                entry("packages/phoenix-client/pyproject.toml", PYPROJECT_PATCH),
                entry("uv.lock", LOCK_PATCH),
            ],
            CLIENT_BUMP,
        )

    def test_combined_release(self) -> None:
        classify(
            [
                MANIFEST_ENTRY,
                entry("CHANGELOG.md", CHANGELOG_PATCH),
                entry("src/phoenix/version.py", VERSION_PY_PATCH),
                entry("packages/phoenix-client/CHANGELOG.md", CHANGELOG_PATCH),
                entry("packages/phoenix-client/pyproject.toml", PYPROJECT_PATCH),
                entry("uv.lock", LOCK_PATCH),
            ],
            {**ROOT_BUMP, **CLIENT_BUMP},
        )

    def test_first_changelog_for_a_new_package_is_an_addition(self) -> None:
        classify(
            [
                MANIFEST_ENTRY,
                entry(
                    "packages/phoenix-client/CHANGELOG.md", "@@ -0,0 +1 @@\n+# Changelog", "added"
                ),
                entry("packages/phoenix-client/pyproject.toml", PYPROJECT_PATCH),
                entry("uv.lock", LOCK_PATCH),
            ],
            CLIENT_BUMP,
        )


class SmuggledChanges(unittest.TestCase):
    """Anything the suites would have exercised must keep them running."""

    def test_unrelated_source_file(self) -> None:
        refuses(
            self,
            [MANIFEST_ENTRY, entry("src/phoenix/server/app.py", "@@ -1 +1 @@\n-a\n+b")],
            ROOT_BUMP,
        )

    def test_workflow_edit(self) -> None:
        refuses(
            self, [MANIFEST_ENTRY, entry(".github/workflows/python-CI.yml", "@@\n+x")], ROOT_BUMP
        )

    def test_dependency_edit_riding_along_with_the_version_bump(self) -> None:
        patch = PYPROJECT_PATCH.replace('   "httpx",', '-  "httpx",\n+  "httpx>=0.28",')
        refuses(
            self,
            [MANIFEST_ENTRY, entry("packages/phoenix-client/pyproject.toml", patch)],
            CLIENT_BUMP,
        )

    def test_version_file_disagreeing_with_the_manifest(self) -> None:
        patch = VERSION_PY_PATCH.replace("20.4.0", "21.0.0")
        refuses(self, [MANIFEST_ENTRY, entry("src/phoenix/version.py", patch)], ROOT_BUMP)

    def test_changelog_for_an_unreleased_package(self) -> None:
        refuses(
            self,
            [MANIFEST_ENTRY, entry("packages/phoenix-otel/CHANGELOG.md", CHANGELOG_PATCH)],
            CLIENT_BUMP,
        )

    def test_changelog_that_deletes_history(self) -> None:
        patch = CHANGELOG_PATCH.replace(
            " ## [3.1.0](https://example.invalid) (2026-08-11)", "-old entry"
        )
        refuses(self, [MANIFEST_ENTRY, entry("CHANGELOG.md", patch)], ROOT_BUMP)

    def test_rename_is_not_a_modification(self) -> None:
        refuses(
            self,
            [MANIFEST_ENTRY, entry("src/phoenix/version.py", VERSION_PY_PATCH, "renamed")],
            ROOT_BUMP,
        )

    def test_mode_only_change_carries_no_hunk(self) -> None:
        patch = "diff --git a/CHANGELOG.md b/CHANGELOG.md\nold mode 100644\nnew mode 100755"
        refuses(self, [MANIFEST_ENTRY, entry("CHANGELOG.md", patch)], ROOT_BUMP)

    def test_binary_rewrite_carries_no_hunk(self) -> None:
        patch = "diff --git a/uv.lock b/uv.lock\nBinary files a/uv.lock and b/uv.lock differ"
        refuses(self, [MANIFEST_ENTRY, entry("uv.lock", patch)], CLIENT_BUMP)

    def test_filename_with_a_trailing_newline(self) -> None:
        self.assertIsNone(PACKAGE_CHANGELOG.match("packages/phoenix-client/CHANGELOG.md\n"))
        refuses(
            self,
            [MANIFEST_ENTRY, entry("packages/phoenix-client/CHANGELOG.md\n", CHANGELOG_PATCH)],
            CLIENT_BUMP,
        )

    def test_binary_file_without_a_patch(self) -> None:
        refuses(self, [MANIFEST_ENTRY, {"filename": "uv.lock", "status": "modified"}], CLIENT_BUMP)


class Lockfile(unittest.TestCase):
    """A lockfile edit counts only inside the block of a released package."""

    def test_third_party_pin_wearing_a_matching_version_pair(self) -> None:
        patch = LOCK_PATCH.replace(
            ' source = { editable = "packages/phoenix-client" }',
            ' source = { registry = "https://pypi.org/simple" }',
        ).replace(' name = "arize-phoenix-client"', ' name = "httpx"')
        refuses(self, [MANIFEST_ENTRY, entry("uv.lock", patch)], CLIENT_BUMP)

    def test_workspace_package_that_is_not_being_released(self) -> None:
        patch = LOCK_PATCH.replace("packages/phoenix-client", "packages/phoenix-otel")
        refuses(self, [MANIFEST_ENTRY, entry("uv.lock", patch)], CLIENT_BUMP)

    def test_version_pair_disagreeing_with_the_manifest(self) -> None:
        patch = LOCK_PATCH.replace('+version = "3.2.0"', '+version = "9.9.9"')
        refuses(self, [MANIFEST_ENTRY, entry("uv.lock", patch)], CLIENT_BUMP)

    def test_registry_pin_vouched_by_a_neighbouring_editable_block(self) -> None:
        """The editable line must sit under the bumped version, not merely nearby."""
        patch = (
            "@@ -880,10 +880,10 @@ dev = [\n"
            ' source = { editable = "packages/phoenix-client" }\n'
            " dependencies = [\n"
            " \n"
            " [[package]]\n"
            ' name = "evil"\n'
            '-version = "3.1.0"\n'
            '+version = "3.2.0"\n'
            ' source = { registry = "https://pypi.org/simple" }'
        )
        refuses(self, [MANIFEST_ENTRY, entry("uv.lock", patch)], CLIENT_BUMP)

    def test_bumped_version_at_the_end_of_a_hunk(self) -> None:
        patch = '@@ -885,7 +885,7 @@\n [[package]]\n-version = "3.1.0"\n+version = "3.2.0"'
        refuses(self, [MANIFEST_ENTRY, entry("uv.lock", patch)], CLIENT_BUMP)

    def test_extra_edit_in_the_same_hunk(self) -> None:
        patch = LOCK_PATCH.replace(
            '     { name = "httpx" },',
            '-    { name = "httpx" },\n+    { name = "requests" },',
        )
        refuses(self, [MANIFEST_ENTRY, entry("uv.lock", patch)], CLIENT_BUMP)


class Manifest(unittest.TestCase):
    def test_added_package(self) -> None:
        with self.assertRaises(NotBookkeeping):
            released_versions({".": "1.0.0"}, {".": "1.0.0", "packages/new": "0.1.0"})

    def test_no_version_moved(self) -> None:
        with self.assertRaises(NotBookkeeping):
            released_versions({".": "1.0.0"}, {".": "1.0.0"})

    def test_reports_every_bump(self) -> None:
        moved = released_versions(
            {".": "1.0.0", "packages/a": "2.0.0"},
            {".": "1.1.0", "packages/a": "2.0.0"},
        )
        self.assertEqual(moved, {".": ("1.0.0", "1.1.0")})


class ChangedFiles(unittest.TestCase):
    """Parsing `git diff --name-status -z`, whose rename records carry two paths."""

    def collect(self, name_status: str, parents: str = "merge base head") -> list:
        import bookkeeping_only

        self.calls: list[tuple[str, ...]] = []

        def fake(*args: str) -> str:
            self.calls.append(args)
            if args[0] == "rev-list":
                return parents
            if "--name-status" in args:
                return name_status
            return "@@ -1 +1 @@\n-old\n+new"

        self.addCleanup(setattr, bookkeeping_only, "git", bookkeeping_only.git)
        bookkeeping_only.git = fake
        return bookkeeping_only.changed_files()

    def test_modified_and_added(self) -> None:
        files = self.collect("M\0CHANGELOG.md\0A\0packages/a/CHANGELOG.md\0")
        self.assertEqual(
            [(f["filename"], f["status"]) for f in files],
            [("CHANGELOG.md", "modified"), ("packages/a/CHANGELOG.md", "added")],
        )
        self.assertTrue(all("patch" in f for f in files))

    def test_rename_arrives_as_a_rejected_deletion(self) -> None:
        """--no-renames splits a rename, and the deletion half is not bookkeeping."""
        files = self.collect("D\0old.py\0A\0new.py\0")
        self.assertEqual(
            [(f["filename"], f["status"]) for f in files],
            [("old.py", "removed"), ("new.py", "added")],
        )
        with self.assertRaises(NotBookkeeping):
            patch_of(files[0], allow_added=True)

    def test_every_diff_disables_rename_detection(self) -> None:
        self.collect("M\0CHANGELOG.md\0")
        diffs = [args for args in self.calls if args[0] == "diff"]
        self.assertEqual(len(diffs), 2)
        self.assertTrue(all("--no-renames" in args for args in diffs))

    def test_deletion_carries_no_patch(self) -> None:
        (deleted,) = self.collect("D\0CHANGELOG.md\0")
        self.assertEqual(deleted["status"], "removed")
        self.assertNotIn("patch", deleted)

    def test_head_without_two_parents(self) -> None:
        with self.assertRaises(NotBookkeeping):
            self.collect("M\0CHANGELOG.md\0", parents="commit onlyparent")

    def test_file_cap(self) -> None:
        with self.assertRaises(NotBookkeeping):
            self.collect("".join(f"M\0f{n}.md\0" for n in range(MAX_FILES + 2)))


class WholePullRequest(unittest.TestCase):
    """decide() with the git layer stubbed, covering the manifest guard."""

    def stub(self, files: list[dict[str, object]], manifests: tuple[dict, dict]) -> None:
        import bookkeeping_only

        self.addCleanup(setattr, bookkeeping_only, "changed_files", bookkeeping_only.changed_files)
        self.addCleanup(setattr, bookkeeping_only, "read_manifest", bookkeeping_only.read_manifest)
        base, head = manifests
        bookkeeping_only.changed_files = lambda: files
        bookkeeping_only.read_manifest = lambda ref: base if ref == bookkeeping_only.BASE else head

    def test_release_pull_request(self) -> None:
        self.stub(
            [MANIFEST_ENTRY, entry("src/phoenix/version.py", VERSION_PY_PATCH)],
            ({".": "20.3.0"}, {".": "20.4.0"}),
        )
        decide()

    def test_manifest_untouched(self) -> None:
        self.stub([entry("CHANGELOG.md", CHANGELOG_PATCH)], ({".": "20.3.0"}, {".": "20.3.0"}))
        with self.assertRaises(NotBookkeeping):
            decide()


class Wiring(unittest.TestCase):
    """The event gate and the output file the workflow step reads back."""

    def run_main(self, event: str = "pull_request", failing: bool = False) -> tuple[bool, str]:
        import bookkeeping_only

        called = []

        def stub() -> None:
            called.append(True)
            if failing:
                raise NotBookkeeping("stubbed")

        self.addCleanup(setattr, bookkeeping_only, "decide", bookkeeping_only.decide)
        bookkeeping_only.decide = stub
        with tempfile.TemporaryDirectory() as directory:
            output_path = os.path.join(directory, "output")
            open(output_path, "w").close()  # Actions pre-creates $GITHUB_OUTPUT
            environment = {"GITHUB_EVENT_NAME": event, "GITHUB_OUTPUT": output_path}
            # Quiet: the detector's own log would otherwise read as a real verdict.
            with mock.patch.dict(os.environ, environment):
                with contextlib.redirect_stdout(io.StringIO()):
                    self.assertEqual(bookkeeping_only.main(), 0)
            with open(output_path) as file:
                return bool(called), file.read()

    def test_release_pull_request_sets_the_output(self) -> None:
        self.assertEqual(self.run_main(), (True, "only=true\n"))

    def test_nothing_is_written_when_the_pull_request_is_not_bookkeeping(self) -> None:
        self.assertEqual(self.run_main(failing=True), (True, ""))

    def test_push_never_reaches_the_detector(self) -> None:
        self.assertEqual(self.run_main(event="push"), (False, ""))


class Hunks(unittest.TestCase):
    def test_splits_context_removed_and_added(self) -> None:
        self.assertEqual(
            hunks("@@ -1,2 +1,2 @@\n keep\n-old\n+new"),
            [(["keep"], ["old"], ["new"])],
        )

    def test_hunk_lines_preserve_order(self) -> None:
        import bookkeeping_only

        self.assertEqual(
            bookkeeping_only.hunk_lines("@@ -1,2 +1,2 @@\n keep\n-old\n+new"),
            [[(" ", "keep"), ("-", "old"), ("+", "new")]],
        )

    def test_ignores_the_git_diff_header(self) -> None:
        patch = "diff --git a/x b/x\nindex a..b 100644\n--- a/x\n+++ b/x\n@@ -1 +1 @@\n-old\n+new"
        self.assertEqual(hunks(patch), [([], ["old"], ["new"])])


if __name__ == "__main__":
    unittest.main()
