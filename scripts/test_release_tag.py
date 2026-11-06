"""Exercise the composite action's Bash with real Git tags and a fake compare API."""

import os
import subprocess
import tempfile
import textwrap
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ACTION = ROOT / ".github/actions/resolve-release-tag/action.yml"


class ReleaseTagTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name)
        self.env = {
            **os.environ,
            "GIT_CONFIG_GLOBAL": os.devnull,
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_AUTHOR_NAME": "Test",
            "GIT_AUTHOR_EMAIL": "test@example.com",
            "GIT_COMMITTER_NAME": "Test",
            "GIT_COMMITTER_EMAIL": "test@example.com",
            "TAG": "release-light",
            "BRANCH": "main",
            "GITHUB_REPOSITORY": "test/repo",
            "GITHUB_OUTPUT": str(self.repo / "output"),
            "COMPARE_STATUS": "behind",
            "API_EXIT": "0",
            "API_LOG": str(self.repo / "api-log"),
            # No credentials or network access are needed by these tests.
            "GH_TOKEN": "",
        }
        self.git("init", "-q", "-b", "main")
        self.git("-c", "commit.gpgsign=false", "commit", "-q", "--allow-empty", "-m", "base")
        self.sha = self.git("rev-parse", "HEAD")
        self.git("tag", "release-light")
        self.git("-c", "tag.gpgsign=false", "tag", "-a", "release-annotated", "-m", "release")
        self.git("remote", "add", "origin", str(self.repo))
        bin_dir = self.repo / "bin"
        bin_dir.mkdir()
        gh = bin_dir / "gh"
        gh.write_text(
            '#!/bin/bash\nset -eu\nprintf "%s\\n" "$@" > "$API_LOG"\n'
            'printf "%s\\n" "$COMPARE_STATUS"\nexit "$API_EXIT"\n'
        )
        gh.chmod(0o755)
        self.env["PATH"] = f"{bin_dir}{os.pathsep}{self.env['PATH']}"
        # This action has one run block, at the end. Execute that exact body so
        # the tests cannot drift from a separately maintained copy of the gate.
        self.script = textwrap.dedent(ACTION.read_text().split("      run: |\n", 1)[1])

    def git(self, *args):
        return subprocess.check_output(
            ["git", *args], cwd=self.repo, env=self.env, text=True, stderr=subprocess.PIPE
        ).strip()

    def run_gate(self, **env):
        return subprocess.run(
            ["bash", "-c", self.script],
            cwd=self.repo,
            env={**self.env, **env},
            text=True,
            capture_output=True,
        )

    def assert_rejected(self, message, **env):
        result = self.run_gate(**env)
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn(f"::error::{message}", result.stdout)
        self.assertFalse((self.repo / "output").exists())

    def test_lightweight_and_annotated_tags_are_pinned_to_commit(self):
        for tag in ("release-light", "release-annotated"):
            for status in ("identical", "behind"):
                with self.subTest(tag=tag, status=status):
                    result = self.run_gate(TAG=tag, COMPARE_STATUS=status)
                    self.assertEqual(result.returncode, 0, result.stderr)
                    output = self.repo / "output"
                    self.assertEqual(output.read_text(), f"revision={self.sha}\n")
                    output.unlink()
                    self.assertIn(
                        f"compare/main...{self.sha}?per_page=1",
                        (self.repo / "api-log").read_text(),
                    )

    def test_unreachable_or_unknown_status_is_rejected(self):
        for status in ("ahead", "diverged", "null", ""):
            with self.subTest(status=status):
                self.assert_rejected("Tag release-light", COMPARE_STATUS=status)

    def test_missing_tag_does_not_call_compare(self):
        self.assert_rejected("Tag missing does not exist", TAG="missing")
        self.assertFalse((self.repo / "api-log").exists())

    def test_invalid_tag_cannot_resolve_another_release(self):
        for tag in ("", "release-*", "release-light\nother"):
            with self.subTest(tag=tag):
                self.assert_rejected("Invalid release tag:", TAG=tag)
                self.assertFalse((self.repo / "api-log").exists())

    def test_empty_branch(self):
        self.assert_rejected("No branch to verify tag", BRANCH="")
        self.assertFalse((self.repo / "api-log").exists())

    def test_git_failure_is_distinct_from_missing_tag(self):
        self.git("remote", "set-url", "origin", str(self.repo / "nonexistent"))
        self.assert_rejected("Could not resolve tag")
        self.assertFalse((self.repo / "api-log").exists())

    def test_api_failure_cannot_publish_even_with_success_status(self):
        self.assert_rejected("Could not verify tag", API_EXIT="1", COMPARE_STATUS="behind")


if __name__ == "__main__":
    unittest.main()
