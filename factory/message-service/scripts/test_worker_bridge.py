# /// script
# requires-python = ">=3.12"
# dependencies = ["anthropic==1.12.1", "PyJWT[crypto]==2.15.1"]
# ///
import io
import json
import os
import tempfile
import unittest
from contextlib import ExitStack, redirect_stdout
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import worker_bridge


class WorkerBridgeTest(unittest.TestCase):
    def setUp(self) -> None:
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        directory = self.stack.enter_context(tempfile.TemporaryDirectory())
        lock_path = Path(directory) / "claude-lock.json"
        dispatch = worker_bridge.dispatch
        resources = {
            key: {"id": key}
            for key in [
                dispatch.ENVIRONMENT_LOCK_KEY,
                dispatch.VAULT_LOCK_KEY,
                dispatch.GRAFANA_VAULT_LOCK_KEY,
                dispatch.DATADOG_VAULT_LOCK_KEY,
                dispatch.LANE_AGENT_LOCK_KEYS["bug"],
            ]
        }
        lock_path.write_text(
            json.dumps({"origin": {"workspace_id": "workers"}, "resources": resources})
        )
        self.stack.enter_context(
            patch.dict(
                os.environ,
                {
                    "FACTORY_WORKER_LOCK_FILE": str(lock_path),
                    "ANTHROPIC_WORKSPACE_ID": "workers",
                    "FACTORY_GITHUB_LOGIN": "factory[bot]",
                    "GH_REPO": "Arize-ai/phoenix",
                },
            )
        )
        for module in (dispatch, worker_bridge.review, worker_bridge.finish):
            self.stack.enter_context(patch.object(module, "LOCK_FILE_PATH", lock_path))
        self.client = MagicMock()
        self.client.beta.sessions.create.return_value = SimpleNamespace(id="actual-session")
        self.client.beta.sessions.events.list.return_value = [SimpleNamespace(id="actual-input")]
        self.stack.enter_context(
            patch.object(worker_bridge.anthropic, "Anthropic", return_value=self.client)
        )
        self.app_token = MagicMock()
        self.app_token.refresh.return_value = "test-app-token"
        self.stack.enter_context(
            patch.object(dispatch, "create_app_token", return_value=self.app_token)
        )
        self.permission = self.stack.enter_context(
            patch.object(dispatch, "read_repo_permission", return_value="write")
        )
        self.request = {
            "repo": "Arize-ai/phoenix",
            "lane": "bug",
            "instruction": "Fix the regression\nREPLYING_TO: signed-marker",
            "reply_binding": "start-binding",
            "issue_numbers": [42],
            "requesters": ["alex", "sam"],
        }
        self.output = io.StringIO()

    def test_checks_all_participant_permissions_before_starting(self) -> None:
        self.permission.side_effect = ["write", "read"]
        worker_bridge.run_request(request=self.request, output=self.output)
        self.assertEqual(
            json.loads(self.output.getvalue()), {"error": "permission_denied", "uncertain": False}
        )
        self.assertEqual(self.permission.call_count, 2)
        self.client.beta.sessions.create.assert_not_called()

    def test_existing_issue_admission_rejects_without_creating_session(self) -> None:
        dispatch = worker_bridge.dispatch
        issue = {"number": 42, "author": {"login": "alex"}, "labels": [{"name": "bug"}]}
        with (
            patch.object(dispatch, "run_gh", return_value=json.dumps(issue)),
            patch.object(dispatch, "list_open_pr_urls", return_value=[]),
            patch.object(dispatch, "find_admission_problem", return_value="not ready") as admission,
            patch.object(dispatch, "comment_on_issue") as comment,
            patch.object(dispatch, "remove_factory_label"),
            redirect_stdout(io.StringIO()),
        ):
            worker_bridge.run_request(request=self.request, output=self.output)
        admission.assert_called_once()
        comment.assert_called_once()
        self.assertEqual(json.loads(self.output.getvalue())["error"], "admission_rejected")
        self.client.beta.sessions.create.assert_not_called()

    def test_existing_start_keeps_resources_and_outcome_adds_instruction_and_runs_watch(
        self,
    ) -> None:
        dispatch = worker_bridge.dispatch
        issue = {
            "number": 42,
            "author": {"login": "alex"},
            "labels": [{"name": "bug"}],
            "_factory_snapshot": {"title": "Regression"},
        }
        with (
            patch.object(dispatch, "run_gh", return_value=json.dumps(issue)),
            patch.object(dispatch, "list_open_pr_urls", return_value=[]),
            patch.object(dispatch, "find_admission_problem", return_value=None),
            patch.object(dispatch, "scan_admission", return_value=None) as scan,
            patch.object(dispatch, "read_noreply_email", return_value="bot@example.com"),
            patch.object(dispatch, "post_status_comment", return_value=9),
            patch.object(dispatch, "run_watch") as watch,
            redirect_stdout(io.StringIO()),
        ):
            worker_bridge.run_request(request=self.request, output=self.output)
        scan.assert_called_once()
        self.assertEqual(
            json.loads(self.output.getvalue()),
            {"session_id": "actual-session"},
        )
        creation = self.client.beta.sessions.create.call_args.kwargs
        self.assertEqual(creation["metadata"]["issues"], "[42]")
        self.assertEqual(creation["metadata"]["factory_reply_id"], "start-binding")
        self.assertIn(
            "REPLYING_TO: signed-marker", creation["initial_events"][0]["content"][-1]["text"]
        )
        self.assertEqual(creation["resources"][0]["type"], "github_repository")
        self.assertEqual(creation["initial_events"][1]["type"], "user.define_outcome")
        self.assertIn("Fix the regression", creation["initial_events"][0]["content"][-1]["text"])
        self.assertEqual(watch.call_args.kwargs["args"].session_id, "actual-session")

    def test_workspace_mismatch_fails_before_using_credentials(self) -> None:
        with patch.dict(os.environ, {"ANTHROPIC_WORKSPACE_ID": "wrong"}):
            with self.assertRaises(ValueError):
                worker_bridge.run_request(request=self.request, output=self.output)
        self.app_token.refresh.assert_not_called()

    def test_main_suppresses_existing_actions_masking_output(self) -> None:
        def fail_with_mask(**_kwargs: object) -> None:
            print("::add-mask::credential-that-must-not-leak")
            raise ValueError("credential-that-must-not-leak")

        output = io.StringIO()
        with (
            patch.object(worker_bridge, "run_request", side_effect=fail_with_mask),
            patch("sys.stdin", io.StringIO("{}")),
            redirect_stdout(output),
        ):
            worker_bridge.main()
        self.assertNotIn("credential-that-must-not-leak", output.getvalue())
        self.assertEqual(json.loads(output.getvalue())["error"], "runtime_failed")


if __name__ == "__main__":
    unittest.main()
