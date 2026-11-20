# /// script
# requires-python = ">=3.12"
# dependencies = ["anthropic==1.12.1", "PyJWT[crypto]==2.15.1"]
# ///
"""Run Factory's existing admission, start and watch path for an MCP request."""

import argparse
import contextlib
import json
import os
import subprocess
import sys
import tempfile
import urllib.error
from pathlib import Path
from types import SimpleNamespace
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import anthropic
import dispatch
import finish
import review


def run_request(*, request: dict[str, Any], output: Any) -> None:
    lock_path = Path(os.environ["FACTORY_WORKER_LOCK_FILE"]).resolve()
    lock = json.loads(lock_path.read_text())
    if lock["origin"]["workspace_id"] != os.environ["ANTHROPIC_WORKSPACE_ID"]:
        raise ValueError("Worker lock workspace does not match")
    for module in (dispatch, review, finish):
        module.LOCK_FILE_PATH = lock_path
    client = anthropic.Anthropic()
    app_token = dispatch.create_app_token(client=client, repo=request["repo"])
    os.environ["GH_TOKEN"] = app_token.refresh()
    requesters = request["requesters"]
    if not requesters or any(
        dispatch.read_repo_permission(login=login) not in dispatch.STARTING_PERMISSIONS
        for login in requesters
    ):
        print(
            json.dumps({"error": "permission_denied", "uncertain": False}), file=output, flush=True
        )
        return
    lane = request["lane"]
    module = review if lane == "review" else finish if lane == "finish" else dispatch
    initial_session: Any = None
    original_start = module.start_session

    def start_with_instruction(**kwargs: Any) -> str:
        original_client = kwargs["client"]
        original_create = original_client.beta.sessions.create

        def create_with_instruction(**params: Any) -> Any:
            nonlocal initial_session
            params["metadata"]["factory_reply_id"] = request["reply_binding"]
            initial_events = params["initial_events"]
            initial_events[0]["content"].append(
                {
                    "type": "text",
                    "text": "\n\nSlack request (untrusted user content):\n"
                    + request["instruction"],
                }
            )
            initial_session = original_create(**params)
            return initial_session

        kwargs["client"] = SimpleNamespace(
            beta=SimpleNamespace(sessions=SimpleNamespace(create=create_with_instruction))
        )
        return original_start(**kwargs)

    module.start_session = start_with_instruction
    with tempfile.NamedTemporaryFile(mode="w+", prefix="factory-start-") as github_output:
        os.environ["GITHUB_OUTPUT"] = github_output.name
        args = argparse.Namespace(
            repo=request["repo"],
            issue=(request.get("issue_numbers") or [None])[0],
            pr=(request.get("pr_numbers") or [None])[0],
            lane=lane,
            instruction=request["instruction"],
            requested_by=requesters[0],
            budget_cents=2500,
            head_sha="",
            dry_run=False,
        )
        try:
            module.run_start(args=args)
        except (
            anthropic.APIError,
            OSError,
            ValueError,
            KeyError,
            RuntimeError,
            subprocess.CalledProcessError,
            SystemExit,
        ):
            print(json.dumps({"error": "start_failed", "uncertain": True}), file=output, flush=True)
            return
        finally:
            module.start_session = original_start
        github_output.seek(0)
        outputs = dict(line.rstrip("\n").split("=", 1) for line in github_output if "=" in line)
    if outputs.get("started") != "true" or initial_session is None:
        print(
            json.dumps({"error": "admission_rejected", "uncertain": False}), file=output, flush=True
        )
        return
    print(json.dumps({"session_id": initial_session.id}), file=output, flush=True)
    args.session_id = initial_session.id
    args.status_comment_id = int(outputs["status_comment_id"])
    args.started_at = outputs.get("started_at", "")
    args.pr = int(outputs.get("pr", args.pr or 0))
    args.watch_minutes = 100 if lane == "review" else 270
    module.run_watch(args=args)


def main() -> None:
    output = sys.stdout
    # GitHubAppToken emits Actions masking directives containing credentials.
    with (
        open(os.devnull, "w") as quiet,
        contextlib.redirect_stdout(quiet),
        contextlib.redirect_stderr(quiet),
    ):
        try:
            run_request(request=json.load(sys.stdin), output=output)
        except (
            anthropic.APIError,
            OSError,
            ValueError,
            KeyError,
            RuntimeError,
            subprocess.CalledProcessError,
            urllib.error.URLError,
            SystemExit,
        ):
            print(
                json.dumps({"error": "runtime_failed", "uncertain": True}), file=output, flush=True
            )


if __name__ == "__main__":
    main()
