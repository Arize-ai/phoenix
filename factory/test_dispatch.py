"""Regression tests for the dispatch CI gate; run with unittest discovery in factory/."""

import itertools
import json
import subprocess
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import finish
from dispatch import find_factory_pr, wait_for_checks, watch_session


def clock_reaching_deadline(*, polls: int) -> itertools.chain[int]:
    """A monotonic clock that allows the given polls, then passes a deadline of 1."""
    return itertools.chain([0] * polls, itertools.repeat(2))


class WaitForChecksTest(unittest.TestCase):
    def test_main_waits_for_required_checks(self) -> None:
        self.assert_checks_finish(base_branch="main", required=True)

    def test_feature_base_waits_for_all_checks(self) -> None:
        self.assert_checks_finish(base_branch="version-online-evals", required=False)

    def assert_checks_finish(self, *, base_branch: str, required: bool) -> None:
        pending = [{"name": "Python CI Required", "bucket": "pending", "link": ""}]
        passed = [{"name": "Python CI Required", "bucket": "pass", "link": ""}]
        with (
            patch("dispatch.time.monotonic", side_effect=clock_reaching_deadline(polls=2)),
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
            {"name": "Python CI Required", "bucket": "fail", "link": ""},
            {"name": "TypeScript CI Required", "bucket": "cancel", "link": ""},
            {"name": "CLAAssistant", "bucket": "pass", "link": ""},
            {"name": "Playwright CI Required", "bucket": "skipping", "link": ""},
        ]
        with (
            patch("dispatch.time.monotonic", side_effect=clock_reaching_deadline(polls=1)),
            patch("dispatch.time.sleep"),
            patch(
                "dispatch.subprocess.run",
                return_value=subprocess.CompletedProcess([], 1, stdout=json.dumps(checks)),
            ),
        ):
            self.assertEqual(
                wait_for_checks(pr_number=42, base_branch="feature", deadline=1), checks[:2]
            )

    def test_feature_base_ignores_checks_main_does_not_require(self) -> None:
        checks = [
            {"name": "Python CI Required", "bucket": "pass", "link": ""},
            {"name": "claude-review", "bucket": "pending", "link": ""},
            {"name": "docs/readthedocs.org:arize-phoenix", "bucket": "fail", "link": ""},
        ]
        with (
            patch("dispatch.time.monotonic", side_effect=clock_reaching_deadline(polls=1)),
            patch("dispatch.time.sleep"),
            patch(
                "dispatch.subprocess.run",
                return_value=subprocess.CompletedProcess([], 1, stdout=json.dumps(checks)),
            ),
        ):
            self.assertEqual(wait_for_checks(pr_number=42, base_branch="feature", deadline=1), [])

    def test_feature_base_waits_when_no_check_main_requires_is_reported(self) -> None:
        checks = [{"name": "claude-review", "bucket": "pass", "link": ""}]
        with (
            patch("dispatch.time.monotonic", side_effect=clock_reaching_deadline(polls=1)),
            patch("dispatch.time.sleep") as sleep,
            patch(
                "dispatch.subprocess.run",
                return_value=subprocess.CompletedProcess([], 0, stdout=json.dumps(checks)),
            ),
        ):
            self.assertIsNone(wait_for_checks(pr_number=42, base_branch="feature", deadline=1))
        sleep.assert_called_once()

    def test_empty_checks_do_not_pass_ci(self) -> None:
        for stdout in ("", "[]"):
            with (
                self.subTest(stdout=stdout),
                patch("dispatch.time.monotonic", side_effect=clock_reaching_deadline(polls=1)),
                patch("dispatch.time.sleep") as sleep,
                patch(
                    "dispatch.subprocess.run",
                    return_value=subprocess.CompletedProcess([], 1, stdout=stdout),
                ),
            ):
                self.assertIsNone(wait_for_checks(pr_number=42, base_branch="feature", deadline=1))
            sleep.assert_called_once()

    def test_watch_session_gates_on_the_prs_base_branch(self) -> None:
        pr = {
            "number": 42,
            "url": "https://github.com/Arize-ai/phoenix/pull/42",
            "headRefOid": "abc123",
            "isDraft": True,
            "baseRefName": "version-online-evals",
        }
        session = SimpleNamespace(outcome_evaluations=[SimpleNamespace(result="satisfied")])
        idle_event = SimpleNamespace(id="event", stop_reason=SimpleNamespace(type="end_turn"))
        with (
            patch("dispatch.wait_for_session", return_value=(session, idle_event)),
            patch("dispatch.wait_for_checks", return_value=None) as wait,
            patch("dispatch.format_cost", return_value="$0.00"),
        ):
            watch_session(
                client=MagicMock(),
                session_id="session",
                lane="feature",
                find_pr=lambda: pr,
                app_token=MagicMock(),
                watch_minutes=1,
            )
        self.assertEqual(wait.call_args.kwargs["base_branch"], "version-online-evals")


class FindPrTest(unittest.TestCase):
    def test_pr_lookups_fetch_the_base_branch(self) -> None:
        for name, find_pr, stdout in (
            ("dispatch", lambda: find_factory_pr(issue_number=42), json.dumps([])),
            ("finish", lambda: finish.find_open_pr(pr_number=42), json.dumps({"state": "OPEN"})),
        ):
            with (
                self.subTest(module=name),
                patch(f"{name}.run_gh", return_value=stdout) as run_gh,
            ):
                find_pr()
            json_fields = run_gh.call_args.args[run_gh.call_args.args.index("--json") + 1]
            self.assertIn("baseRefName", json_fields.split(","))
