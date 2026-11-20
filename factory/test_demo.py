# /// script
# requires-python = ">=3.12"
# dependencies = ["anthropic==1.12.1", "PyJWT[crypto]==2.15.1"]
# ///
"""Tests for the demo lane's rules: which pull requests `check` labels, and what `watch`
reports. Run with `uv run --script factory/test_demo.py`."""

import unittest
from pathlib import Path
from typing import Any, Optional

from demo import (
    DEMO_LABEL,
    DEMOED_LABEL,
    find_demo_problem,
    format_demo_report,
    has_visual_evidence,
    is_ui_path,
    read_demoed_sha,
)

FACTORY_LOGIN = "arize-phoenix-factory[bot]"
HEAD_SHA = "a" * 40
TEMPLATE_BODY = (Path(__file__).parent.parent / ".github" / "pull_request_template.md").read_text()
UI_CHANGE = ["js/app/src/pages/project/SpansTable.tsx"]


def make_pr(**overrides: Any) -> dict[str, Any]:
    pr = {
        "state": "OPEN",
        "isDraft": False,
        "author": {"login": "maintainer", "is_bot": False},
        "title": "feat(ui): add a latency column to the spans table",
        "headRefName": "maintainer/new-table",
        "labels": [],
        "body": "## What\n\nAdds a column to the spans table.",
    }
    return {**pr, **overrides}


def find_problem(
    *, pr: dict[str, Any], changed_paths: list[str], permission: str = "write"
) -> Optional[str]:
    return find_demo_problem(
        pr=pr,
        changed_paths=changed_paths,
        author_permission=permission,
        factory_login=FACTORY_LOGIN,
    )


class FindDemoProblemTest(unittest.TestCase):
    def test_labels_a_core_contributors_ui_pr_without_screenshots(self) -> None:
        self.assertIsNone(find_problem(pr=make_pr(), changed_paths=UI_CHANGE))

    def test_labels_a_pr_whose_body_is_the_unfilled_template(self) -> None:
        self.assertIsNone(find_problem(pr=make_pr(body=TEMPLATE_BODY), changed_paths=UI_CHANGE))

    def test_labels_fixes_and_breaking_changes(self) -> None:
        for title in ["fix: keep the table sorted", "feat(ui)!: replace the spans table"]:
            with self.subTest(title):
                self.assertIsNone(find_problem(pr=make_pr(title=title), changed_paths=UI_CHANGE))

    def test_skips_prs_the_lane_is_not_for(self) -> None:
        cases = {
            "no write access": (make_pr(author={"login": "someone", "is_bot": False}), "read"),
            "bot": (make_pr(author={"login": "renovate", "is_bot": True}), "write"),
            "factory branch": (make_pr(headRefName="factory/issue-123"), "write"),
            "draft": (make_pr(isDraft=True), "write"),
            "refactor": (make_pr(title="refactor(ui): split the spans table"), "write"),
            "perf": (make_pr(title="perf(ui): memoize span rows"), "write"),
            "demoed": (make_pr(labels=[{"name": DEMOED_LABEL.name}]), "write"),
            "running": (make_pr(labels=[{"name": DEMO_LABEL.name}]), "write"),
            "has a screenshot": (
                make_pr(body="![after](https://github.com/user-attachments/assets/1)"),
                "write",
            ),
        }
        for case, (pr, permission) in cases.items():
            with self.subTest(case):
                self.assertIsNotNone(
                    find_problem(pr=pr, changed_paths=UI_CHANGE, permission=permission)
                )

    def test_skips_a_pr_that_changes_no_rendered_ui(self) -> None:
        changed_paths = [
            "js/app/src/pages/project/__tests__/SpansTable.test.tsx",
            "js/app/src/pages/project/__generated__/SpansTableQuery.graphql.ts",
            "js/app/src/components/table/Table.stories.tsx",
            "src/phoenix/server/api/types/Span.py",
        ]
        self.assertEqual(
            find_problem(pr=make_pr(), changed_paths=changed_paths), "it changes no UI"
        )


class IsUiPathTest(unittest.TestCase):
    def test_is_ui_path(self) -> None:
        cases = {
            "js/app/src/pages/project/SpansTable.tsx": True,
            "js/app/src/components/theme.css": True,
            "js/app/src/utils/formatUtils.ts": True,
            "js/app/src/pages/project/__tests__/SpansTable.test.tsx": False,
            "js/app/src/utils/formatUtils.test.ts": False,
            "js/app/src/__generated__/schema.graphql.ts": False,
            "js/app/stories/Table.stories.tsx": False,
            "js/packages/phoenix-client/src/client.ts": False,
        }
        for path, expected in cases.items():
            with self.subTest(path):
                self.assertIs(is_ui_path(path), expected)


class HasVisualEvidenceTest(unittest.TestCase):
    def test_finds_screenshots_and_videos(self) -> None:
        bodies = [
            "![the new column](https://github.com/user-attachments/assets/1234)",
            "**Look at the column**\n\nhttps://github.com/user-attachments/assets/5678",
            '<img width="600" alt="table" src="https://example.com/table">',
            "<video src=x></video>",
            "Before: https://example.com/shots/before.PNG",
        ]
        for body in bodies:
            with self.subTest(body):
                self.assertTrue(has_visual_evidence(body=body))

    def test_ignores_screenshots_inside_html_comments(self) -> None:
        self.assertFalse(
            has_visual_evidence(body="<!-- add ![a screenshot](./x.png) here -->\nNo images.")
        )


class DemoSectionTest(unittest.TestCase):
    def test_reads_the_demoed_commit_from_the_section(self) -> None:
        body = (
            "## What\n\nAdds a column.\n\n"
            f"<!-- factory-demo:start sha={HEAD_SHA} -->\n## Factory demo\n...\n"
            "<!-- factory-demo:end -->"
        )
        self.assertEqual(read_demoed_sha(body=body), HEAD_SHA)

    def test_reads_no_commit_from_an_unterminated_section(self) -> None:
        self.assertIsNone(
            read_demoed_sha(body=f"<!-- factory-demo:start sha={HEAD_SHA} -->\n## Factory")
        )

    def test_reports_a_demo_only_for_the_admitted_commit(self) -> None:
        cases = {HEAD_SHA: "added before and after screenshots", "b" * 40: "not aaaaaaaaaa"}
        for demoed_sha, expected_phrase in cases.items():
            with self.subTest(demoed_sha=demoed_sha):
                report = format_report(demoed_sha=demoed_sha, final_message="")
                self.assertIn(expected_phrase, report)
                self.assertTrue(report.startswith("The factory"))

    def test_reports_the_agents_reason_when_nothing_is_visible(self) -> None:
        final_message = (
            "Read the diff.\n"
            "`NO_VISIBLE_CHANGE`: the hook only memoizes rows the table already shows.\n"
            'FACTORY_ARTIFACTS={"issues":[],"prs":[123]}'
        )
        report = format_report(demoed_sha=None, final_message=final_message)
        self.assertIn("found nothing to capture", report)
        self.assertIn("the hook only memoizes rows the table already shows", report)

    def test_reports_a_session_that_ended_without_a_section(self) -> None:
        report = format_report(demoed_sha=None, final_message="Ran out of budget.")
        self.assertIn("ended without adding screenshots", report)


def format_report(*, demoed_sha: Optional[str], final_message: str) -> str:
    return format_demo_report(
        demoed_sha=demoed_sha,
        head_sha=HEAD_SHA,
        final_message=final_message,
        session_id="sesn_1",
        stop_reason="end_turn",
    )


if __name__ == "__main__":
    unittest.main()
