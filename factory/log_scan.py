"""Triage a day of Phoenix server errors from Grafana into GitHub issues.

The script is a gate and a starter. It counts the error lines Loki has for the window;
with none, it exits without spending anything. Otherwise it starts a session with the
railway-triage agent, which reads the errors and the code, checks the open `railway-dev` issues,
and files or updates issues itself. Unless `--no-dispatch` is given, the `railway-dev` issues
the session created then get the `factory` label, up to `--max-dispatch` of them, so
factory-dispatch.yml runs the bug lane on each.

Environment: FACTORY_GRAFANA_URL, FACTORY_GRAFANA_TOKEN (a Grafana service-account token
with the Viewer role), FACTORY_GRAFANA_LOGQL (the selector for server errors), optionally
FACTORY_GRAFANA_LOKI_UID, and for the session ANTHROPIC_API_KEY and FACTORY_GITHUB_TOKEN.
"""

import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import anthropic
from dispatch import (
    ENVIRONMENT_LOCK_KEY,
    FACTORY_DIR,
    FACTORY_LABEL,
    LOCK_FILE_PATH,
    format_cost,
    format_session_link,
    read_lock_id,
    read_vault_ids,
    run_gh,
    wait_for_session,
)

SOURCE_LABEL = "railway-dev"
TRIAGE_AGENT_LOCK_KEY = "./agents/railway-triage.md"
TRIAGE_RUBRIC_PATH = FACTORY_DIR / "rubrics" / "railway-triage.md"
LOKI_QUERY_LIMIT = 5000
TRIAGE_OUTCOME = (
    "Every Phoenix server error in the window that a maintainer should fix has exactly one "
    "open issue in {repo}: a comment on the existing issue when one covers it, otherwise a "
    "new issue labeled bug and railway-dev whose title says what the user experiences."
)


class GrafanaClient:
    def __init__(self, *, url: str, token: str) -> None:
        self.url = url.rstrip("/")
        self.token = token

    def get_json(self, path: str, params: Optional[dict[str, str]] = None) -> Any:
        query_string = f"?{urllib.parse.urlencode(params)}" if params else ""
        request = urllib.request.Request(
            f"{self.url}{path}{query_string}",
            headers={"Authorization": f"Bearer {self.token}", "Accept": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.load(response)

    def find_loki_datasource_uid(self, *, preferred_uid: Optional[str]) -> str:
        if preferred_uid:
            return preferred_uid
        loki_datasources = [
            datasource
            for datasource in self.get_json("/api/datasources")
            if datasource["type"] == "loki"
        ]
        if not loki_datasources:
            raise SystemExit("Grafana has no Loki datasource; set FACTORY_GRAFANA_LOKI_UID.")
        return str(loki_datasources[0]["uid"])

    def count_loki_lines(
        self, *, datasource_uid: str, logql: str, start: datetime, end: datetime
    ) -> int:
        """Return how many lines match `logql` in the window, up to the query limit."""
        result = self.get_json(
            f"/api/datasources/proxy/uid/{datasource_uid}/loki/api/v1/query_range",
            {
                "query": logql,
                "start": str(int(start.timestamp() * 1_000_000_000)),
                "end": str(int(end.timestamp() * 1_000_000_000)),
                "limit": str(LOKI_QUERY_LIMIT),
                "direction": "backward",
            },
        )
        if result.get("status") != "success":
            raise SystemExit(f"Loki query failed: {json.dumps(result)[:500]}")
        return sum(len(stream["values"]) for stream in result["data"]["result"])


def format_timestamp(moment: datetime) -> str:
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_timestamp(text: str) -> datetime:
    return datetime.fromisoformat(text.replace("Z", "+00:00"))


def start_triage_session(
    *,
    client: anthropic.Anthropic,
    repo: str,
    github_token: str,
    datasource_uid: str,
    logql: str,
    window_start: datetime,
    window_end: datetime,
    line_count: int,
    budget_cents: int,
) -> str:
    lock = json.loads(LOCK_FILE_PATH.read_text())
    # Only maintainer-set values go in the prompt; the agent reads the untrusted log lines
    # itself through the Grafana MCP server.
    kickoff_text = (
        f"Triage the Phoenix server errors logged between {format_timestamp(window_start)} and "
        f"{format_timestamp(window_end)} into issues in {repo}. The Loki datasource UID is "
        f"{datasource_uid}. The LogQL that selects server errors is:\n\n{logql}\n\n"
        f"It matched {line_count} lines in the window."
    )
    session = client.beta.sessions.create(
        agent=read_lock_id(lock=lock, lock_key=TRIAGE_AGENT_LOCK_KEY),
        environment_id=read_lock_id(lock=lock, lock_key=ENVIRONMENT_LOCK_KEY),
        vault_ids=read_vault_ids(lock=lock),
        title=f"railway triage: {repo} {window_end.strftime('%Y-%m-%d')}",
        metadata={"repo": repo, "lane": "railway-triage"},
        budget={
            "type": "limit",
            "max_list_cost": {"amount": str(budget_cents), "currency": "USD"},
        },
        resources=[
            {
                "type": "github_repository",
                "url": f"https://github.com/{repo}",
                "authorization_token": github_token,
                "checkout": {"type": "branch", "name": "main"},
            }
        ],
        initial_events=[
            {"type": "user.message", "content": [{"type": "text", "text": kickoff_text}]},
            {
                "type": "user.define_outcome",
                "description": TRIAGE_OUTCOME.format(repo=repo),
                "rubric": {"type": "text", "content": TRIAGE_RUBRIC_PATH.read_text()},
                "max_iterations": 2,
            },
        ],
    )
    return session.id


def list_source_issues(*, repo: str, token: str, since: datetime) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = json.loads(
        run_gh(
            "issue",
            "list",
            "--repo",
            repo,
            "--label",
            SOURCE_LABEL,
            "--state",
            "open",
            "--limit",
            "100",
            "--json",
            "number,title,url,createdAt,updatedAt",
            token=token,
        )
    )
    return [issue for issue in issues if parse_timestamp(issue["updatedAt"]) >= since]


def write_step_summary(lines: list[str]) -> None:
    if summary_path := os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(summary_path, "a") as summary:
            summary.writelines(lines)
    else:
        sys.stdout.writelines(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", required=True, help="owner/name, e.g. Arize-ai/phoenix")
    parser.add_argument("--hours", type=float, default=24.0, help="Window to scan, ending now")
    parser.add_argument(
        "--overlap-minutes",
        type=float,
        default=5.0,
        help="Extra minutes so consecutive runs never leave a gap",
    )
    parser.add_argument(
        "--budget-cents", type=int, default=1000, help="Session spend cap, USD cents"
    )
    parser.add_argument(
        "--watch-minutes", type=int, default=90, help="How long to wait for the session"
    )
    parser.add_argument(
        "--no-dispatch",
        action="store_true",
        help="Don't label the issues the session created `factory`",
    )
    parser.add_argument(
        "--max-dispatch",
        type=int,
        default=3,
        help="Most issues to label `factory` per run; each starts a bug-lane session",
    )
    parser.add_argument("--dry-run", action="store_true", help="Count the errors and stop")
    args = parser.parse_args()

    grafana = GrafanaClient(
        url=os.environ["FACTORY_GRAFANA_URL"], token=os.environ["FACTORY_GRAFANA_TOKEN"]
    )
    logql = os.environ["FACTORY_GRAFANA_LOGQL"]
    datasource_uid = grafana.find_loki_datasource_uid(
        preferred_uid=os.environ.get("FACTORY_GRAFANA_LOKI_UID")
    )
    window_end = datetime.now(timezone.utc)
    window_start = window_end - timedelta(hours=args.hours, minutes=args.overlap_minutes)
    line_count = grafana.count_loki_lines(
        datasource_uid=datasource_uid, logql=logql, start=window_start, end=window_end
    )
    print(
        f"datasource={datasource_uid} window={format_timestamp(window_start)}"
        f"..{format_timestamp(window_end)} lines={line_count}"
    )
    summary = [
        f"## Railway triage\n\n{line_count} error lines in the last {args.hours:g} hours\n\n"
    ]
    if line_count == 0 or args.dry_run:
        if line_count:
            print("dry run: would start a railway-triage session")
        write_step_summary(summary)
        return

    github_token = os.environ["FACTORY_GITHUB_TOKEN"]
    client = anthropic.Anthropic()
    session_start = datetime.now(timezone.utc)
    session_id = start_triage_session(
        client=client,
        repo=args.repo,
        github_token=github_token,
        datasource_uid=datasource_uid,
        logql=logql,
        window_start=window_start,
        window_end=window_end,
        line_count=line_count,
        budget_cents=args.budget_cents,
    )
    print(f"session_id={session_id}")
    summary.append(f"Session {format_session_link(session_id=session_id)}\n\n")

    session, idle_event = wait_for_session(
        client=client,
        session_id=session_id,
        previous_idle_event_id=None,
        deadline=time.monotonic() + args.watch_minutes * 60,
    )
    if session is None:
        summary.append(f"Still running after {args.watch_minutes} minutes.\n")
        write_step_summary(summary)
        raise SystemExit("The railway-triage session is still running; see the Claude Console.")
    latest_outcome = session.outcome_evaluations[-1] if session.outcome_evaluations else None
    outcome_result = latest_outcome.result if latest_outcome else "not graded"
    stop_reason = idle_event.stop_reason.type if idle_event else "terminated"
    cost = format_cost(session=session)
    print(f"stop_reason={stop_reason} outcome={outcome_result} cost={cost}")
    summary.append(f"Ended with `{stop_reason}`, rubric `{outcome_result}`, cost {cost}\n\n")

    # The session files and comments as the machine account; find what it touched by time.
    touched_issues = list_source_issues(repo=args.repo, token=github_token, since=session_start)
    dispatched = 0
    for issue in sorted(touched_issues, key=lambda issue: issue["createdAt"]):
        is_new = parse_timestamp(issue["createdAt"]) >= session_start
        dispatch = is_new and not args.no_dispatch and dispatched < args.max_dispatch
        if dispatch:
            dispatched += 1
            run_gh(
                "issue",
                "edit",
                str(issue["number"]),
                "--repo",
                args.repo,
                "--add-label",
                FACTORY_LABEL,
                token=github_token,
            )
        verb = "filed" if is_new else "updated"
        suffix = ", labeled factory" if dispatch else ""
        print(f"{verb}{suffix} #{issue['number']}: {issue['title']}")
        summary.append(f"- {verb}{suffix}: [#{issue['number']}]({issue['url']}) {issue['title']}\n")
    if not touched_issues:
        summary.append("No issues filed or updated.\n")
    undispatched = (
        sum(1 for issue in touched_issues if parse_timestamp(issue["createdAt"]) >= session_start)
        - dispatched
    )
    if undispatched and not args.no_dispatch:
        summary.append(
            f"\n{undispatched} new issue(s) left for a maintainer to label: the per-run cap is "
            f"{args.max_dispatch}.\n"
        )
    write_step_summary(summary)
    if stop_reason != "end_turn":
        raise SystemExit(f"The session stopped with {stop_reason}; see the Claude Console.")


if __name__ == "__main__":
    main()
