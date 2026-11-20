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

import dispatch
import finish
import review
from message_request import MessageRequest, read_message_request


class MessageRequestTest(unittest.TestCase):
    def setUp(self) -> None:
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        directory = Path(self.stack.enter_context(tempfile.TemporaryDirectory()))
        self.lock_path = directory / "lock.json"
        keys = [
            dispatch.ENVIRONMENT_LOCK_KEY,
            dispatch.VAULT_LOCK_KEY,
            dispatch.GRAFANA_VAULT_LOCK_KEY,
            dispatch.DATADOG_VAULT_LOCK_KEY,
            *dispatch.LANE_AGENT_LOCK_KEYS.values(),
            review.REVIEW_AGENT_LOCK_KEY,
            finish.FINISH_AGENT_LOCK_KEY,
        ]
        self.lock_path.write_text(
            json.dumps(
                {
                    "origin": {"workspace_id": "factory-workspace"},
                    "resources": {key: {"id": key} for key in keys},
                }
            )
        )
        self.event_path = directory / "event.json"
        self.request = {
            "instruction": "Do the requested work\nREPLYING_TO: signed-return-marker",
            "reply_binding": "d4885342-68ea-457f-9358-9ba532d49bf8",
            "requesters": ["alex", "sam"],
            "workspace_id": "factory-workspace",
        }
        self.write_event()
        self.stack.enter_context(
            patch.dict(
                os.environ,
                {
                    "GITHUB_EVENT_NAME": "workflow_dispatch",
                    "GITHUB_EVENT_PATH": str(self.event_path),
                },
            )
        )
        for module in [dispatch, review, finish]:
            self.stack.enter_context(patch.object(module, "LOCK_FILE_PATH", self.lock_path))
        self.permission = MagicMock(return_value="write")

    def write_event(self) -> None:
        self.event_path.write_text(
            json.dumps(
                {
                    "inputs": {"message_request": json.dumps(self.request)},
                    "sender": {"login": "dispatcher"},
                }
            )
        )

    def read_request(self) -> MessageRequest:
        request = read_message_request(lock_path=self.lock_path, read_permission=self.permission)
        self.assertIsNotNone(request)
        return request

    def test_checks_every_participant_and_keeps_exact_instruction(self) -> None:
        request = self.read_request()
        self.assertEqual(request.instruction, self.request["instruction"])
        self.assertEqual(request.requesters, ["alex", "sam"])
        self.assertEqual(
            [call.kwargs["login"] for call in self.permission.call_args_list],
            ["dispatcher", "alex", "sam"],
        )

    def test_rejects_one_participant_without_write_access(self) -> None:
        self.permission.side_effect = ["write", "write", "read"]
        with self.assertRaisesRegex(ValueError, "write access"):
            self.read_request()

    def test_dispatcher_cannot_impersonate_a_permitted_participant(self) -> None:
        self.permission.return_value = "read"
        with self.assertRaisesRegex(ValueError, "dispatcher"):
            self.read_request()
        self.permission.assert_called_once_with(login="dispatcher")

    def test_rejects_wrong_workspace_before_permission_requests(self) -> None:
        self.request["workspace_id"] = "different-workspace"
        self.write_event()
        with self.assertRaisesRegex(ValueError, "workspace"):
            self.read_request()
        self.permission.assert_not_called()

    def test_rejects_invalid_binding_missing_participants_and_non_json_input(self) -> None:
        for field, value in [
            ("reply_binding", "not-a-uuid"),
            ("requesters", []),
            ("requesters", ["alex;command"]),
        ]:
            with self.subTest(field=field, value=value):
                original = self.request[field]
                self.request[field] = value
                self.write_event()
                with self.assertRaises(ValueError):
                    self.read_request()
                self.request[field] = original
        self.event_path.write_text(json.dumps({"inputs": {"message_request": "not-json"}}))
        with self.assertRaises(ValueError):
            self.read_request()

    def test_keeps_existing_label_and_manual_workflows_without_message_input(self) -> None:
        self.event_path.write_text(json.dumps({"inputs": {"issue": "42"}}))
        self.assertIsNone(
            read_message_request(lock_path=self.lock_path, read_permission=self.permission)
        )
        with patch.dict(os.environ, {"GITHUB_EVENT_NAME": "issues"}):
            self.write_event()
            self.assertIsNone(
                read_message_request(lock_path=self.lock_path, read_permission=self.permission)
            )
        self.permission.assert_not_called()

    def test_existing_admission_rejects_closed_or_scanner_blocked_targets_without_starting(
        self,
    ) -> None:
        args = SimpleNamespace(
            repo="Arize-ai/phoenix",
            issue=7,
            pr=42,
            lane="bug",
            requested_by="dispatcher",
            head_sha="",
            dry_run=False,
        )
        for module in [dispatch, review, finish]:
            for state in ["CLOSED", "OPEN"]:
                with self.subTest(module=module.__name__, state=state), ExitStack() as stack:
                    subject = {
                        "number": 7 if module is dispatch else 42,
                        "state": state,
                        "author": {"login": "alex"},
                        "labels": [{"name": "bug"}],
                        "assignees": [],
                        "isCrossRepository": False,
                        "headRefOid": "head-sha",
                    }
                    client = MagicMock()
                    app_token = MagicMock()
                    app_token.refresh.return_value = "test-token"
                    stack.enter_context(
                        patch.object(module.anthropic, "Anthropic", return_value=client)
                    )
                    stack.enter_context(
                        patch.object(module, "create_app_token", return_value=app_token)
                    )
                    stack.enter_context(
                        patch.object(module, "read_repo_permission", return_value="write")
                    )
                    scanner = stack.enter_context(
                        patch.object(module, "scan_admission", return_value="scanner rejected")
                    )
                    outputs = stack.enter_context(patch.object(module, "write_github_outputs"))
                    if module is dispatch:
                        stack.enter_context(
                            patch.object(module, "run_gh", return_value=json.dumps(subject))
                        )
                        stack.enter_context(
                            patch.object(module, "list_open_pr_urls", return_value=[])
                        )
                        stack.enter_context(patch.object(module, "comment_on_issue"))
                        stack.enter_context(patch.object(module, "remove_factory_label"))
                    else:
                        stack.enter_context(patch.object(module, "read_pr", return_value=subject))
                        stack.enter_context(patch.object(module, "comment_on_pr"))
                        stack.enter_context(
                            patch.object(
                                module,
                                "remove_review_label"
                                if module is review
                                else "remove_finish_label",
                            )
                        )
                    with redirect_stdout(io.StringIO()):
                        module.run_start(args=args)
                    outputs.assert_called_once_with(started="false")
                    client.beta.sessions.create.assert_not_called()
                    if state == "OPEN":
                        scanner.assert_called_once()
                    else:
                        scanner.assert_not_called()

    def test_all_existing_lane_creators_keep_resources_and_outcomes_with_request_binding(
        self,
    ) -> None:
        request = self.read_request()
        pr = {
            "number": 42,
            "headRefOid": "head-sha",
            "baseRefOid": "base-sha",
            "baseRefName": "main",
            "headRefName": "factory/issue-42",
            "isCrossRepository": False,
            "_factory_snapshot": {"title": "Test PR"},
            "closingIssuesReferences": [{"number": 7}],
        }
        common = {
            "repo": "Arize-ai/phoenix",
            "github_token": "repository-test-token",
            "budget_cents": 2500,
            "message_request": request,
        }
        client = MagicMock()
        client.beta.sessions.create.return_value = SimpleNamespace(id="actual-session")
        with patch.object(review, "read_open_factory_threads", return_value=[]):
            for lane in ["bug", "feature", "docs", "review", "finish"]:
                with self.subTest(lane=lane):
                    if lane in dispatch.LANE_AGENT_LOCK_KEYS:
                        session = dispatch.start_session(
                            client=client,
                            lane=lane,
                            issue_number=7,
                            label_names=["bug"],
                            snapshot={"title": "Issue"},
                            git_author_name="factory",
                            git_author_email="factory@example.com",
                            **common,
                        )
                    elif lane == "review":
                        session = review.start_session(
                            client=client, pr=pr, factory_login="factory", **common
                        )
                    else:
                        session = finish.start_session(
                            client=client,
                            pr=pr,
                            requester_login="alex",
                            git_author_name="factory",
                            git_author_email="factory@example.com",
                            **common,
                        )
                    self.assertEqual(session, "actual-session")
                    creation = client.beta.sessions.create.call_args.kwargs
                    self.assertEqual(
                        creation["metadata"]["factory_reply_id"], request.reply_binding
                    )
                    self.assertIn(
                        request.instruction, creation["initial_events"][0]["content"][0]["text"]
                    )
                    self.assertEqual(creation["metadata"]["lane"], lane)
                    self.assertEqual(creation["resources"][0]["type"], "github_repository")
                    self.assertEqual(
                        creation["vault_ids"],
                        [
                            dispatch.VAULT_LOCK_KEY,
                            dispatch.GRAFANA_VAULT_LOCK_KEY,
                            dispatch.DATADOG_VAULT_LOCK_KEY,
                        ],
                    )
                    self.assertEqual(creation["environment_id"], dispatch.ENVIRONMENT_LOCK_KEY)
                    if lane != "review":
                        self.assertEqual(
                            creation["initial_events"][1]["type"], "user.define_outcome"
                        )


if __name__ == "__main__":
    unittest.main()
