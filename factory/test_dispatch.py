"""Regression tests for the dispatch CI gate; run with unittest discovery in factory/."""

import json
import subprocess
import unittest
from unittest.mock import patch

from dispatch import main, wait_for_checks


class WaitForChecksTest(unittest.TestCase):
    def test_main_waits_for_required_checks(self) -> None:
        self.assert_checks_finish(base_branch="main", required=True)

    def test_feature_base_waits_for_all_checks(self) -> None:
        self.assert_checks_finish(base_branch="version-online-evals", required=False)

    def assert_checks_finish(self, *, base_branch: str, required: bool) -> None:
        pending = [{"name": "CI", "bucket": "pending", "link": ""}]
        passed = [{"name": "CI", "bucket": "pass", "link": ""}]
        with (
            patch("dispatch.time.monotonic", return_value=0),
            patch("dispatch.time.sleep") as sleep,
            patch(
                "dispatch.subprocess.run",
                side_effect=[
                    subprocess.CompletedProcess([], 8, stdout=json.dumps(pending)),
                    subprocess.CompletedProcess([], 0, stdout=json.dumps(passed)),
                ],
            ) as run,
        ):
            self.assertEqual(wait_for_checks(pr_number=42, base_branch=base_branch, deadline=1), [])
        sleep.assert_called_once()
        self.assertEqual(run.call_count, 2)
        for call in run.call_args_list:
            self.assertEqual("--required" in call.args[0], required)

    def test_feature_base_returns_failed_and_cancelled_checks(self) -> None:
        checks = [
            {"name": "lint", "bucket": "fail", "link": ""},
            {"name": "tests", "bucket": "cancel", "link": ""},
            {"name": "build", "bucket": "pass", "link": ""},
            {"name": "docs", "bucket": "skipping", "link": ""},
        ]
        with (
            patch("dispatch.time.monotonic", return_value=0),
            patch(
                "dispatch.subprocess.run",
                return_value=subprocess.CompletedProcess([], 1, stdout=json.dumps(checks)),
            ),
        ):
            self.assertEqual(
                wait_for_checks(pr_number=42, base_branch="feature", deadline=1), checks[:2]
            )

    def test_empty_checks_do_not_pass_ci(self) -> None:
        for stdout in ("", "[]"):
            with (
                self.subTest(stdout=stdout),
                patch("dispatch.time.monotonic", side_effect=[0, 2]),
                patch("dispatch.time.sleep") as sleep,
                patch(
                    "dispatch.subprocess.run",
                    return_value=subprocess.CompletedProcess([], 1, stdout=stdout),
                ),
            ):
                self.assertIsNone(wait_for_checks(pr_number=42, base_branch="feature", deadline=1))
            sleep.assert_called_once()

    def test_watch_accepts_base_and_defaults_to_main(self) -> None:
        for base_args, expected_base in (([], "main"), (["--base", "feature"], "feature")):
            with (
                self.subTest(base=expected_base),
                patch(
                    "sys.argv",
                    [
                        "dispatch.py",
                        "--repo",
                        "Arize-ai/phoenix",
                        "--issue",
                        "42",
                        "watch",
                        "--session-id",
                        "session",
                        "--lane",
                        "feature",
                        *base_args,
                    ],
                ),
                patch("dispatch.run_watch") as watch,
            ):
                main()
            self.assertEqual(watch.call_args.kwargs["args"].base, expected_base)
