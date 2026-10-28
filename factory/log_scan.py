"""Triage a day of Phoenix server errors into GitHub issues.

The script is a gate and a starter. It counts the error lines the source has for the window;
with none, it exits without spending anything. Otherwise it starts a session with the source's
triage agent, which reads the errors and the code, checks the open issues carrying the source's
label, and files or updates issues itself. Unless `--no-dispatch` is given, the issues the
session created then get the `factory` label, so factory-dispatch.yml runs the bug lane on
each.

Two sources, chosen with `--source`:

- `railway`: the Phoenix team's internal Railway deployment, whose logs are in Grafana Loki.
  Environment: FACTORY_GRAFANA_URL, FACTORY_GRAFANA_TOKEN (a Grafana service-account token with
  the Viewer role), FACTORY_GRAFANA_LOGQL (the selector for server errors) and optionally
  FACTORY_GRAFANA_LOKI_UID. Issues are labeled `railway-dev`.
- `cloud`: Phoenix Cloud, the multi-tenant production deployment Arize runs, whose logs and
  traces are in Datadog. Environment: FACTORY_DATADOG_TOKEN (a Service Access Token with
  `logs_read_data`), FACTORY_DATADOG_QUERY (the log search that selects server errors) and
  optionally FACTORY_DATADOG_SITE. Issues are labeled `phoenix-cloud`.

Every source also needs ANTHROPIC_API_KEY, FACTORY_APP_CLIENT_ID and FACTORY_APP_PRIVATE_KEY
for the session.
"""

import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional, Protocol

import anthropic
from dispatch import (
    ENVIRONMENT_LOCK_KEY,
    FACTORY_DIR,
    FACTORY_LABEL,
    LOCK_FILE_PATH,
    create_app_token,
    format_cost,
    format_session_link,
    read_lock_id,
    read_vault_ids,
    run_gh,
    wait_for_session,
)

LOKI_QUERY_LIMIT = 5000
DEFAULT_DATADOG_SITE = "datadoghq.com"
TRIAGE_OUTCOME = (
    "Every Phoenix server error in the window that a maintainer should fix has exactly one "
    "open issue in {repo}: a comment on the existing issue when one covers it, otherwise a "
    "new issue labeled bug and {label} whose title says what the user experiences."
)


@dataclass(frozen=True)
class TriageSource:
    """A deployment whose errors get triaged: its issue label and its triage agent."""

    name: str
    heading: str
    label: str
    agent_lock_key: str
    rubric_path: Path


RAILWAY = TriageSource(
    name="railway",
    heading="Railway triage",
    label="railway-dev",
    agent_lock_key="./agents/railway-triage.md",
    rubric_path=FACTORY_DIR / "rubrics" / "railway-triage.md",
)
CLOUD = TriageSource(
    name="cloud",
    heading="Phoenix Cloud triage",
    label="phoenix-cloud",
    agent_lock_key="./agents/cloud-triage.md",
    rubric_path=FACTORY_DIR / "rubrics" / "cloud-triage.md",
)
SOURCES = {source.name: source for source in (RAILWAY, CLOUD)}


class ErrorStore(Protocol):
    """A deployment's log store: counts the window's errors and briefs the triage agent."""

    source: TriageSource

    def count_errors(self, *, start: datetime, end: datetime) -> int: ...

    def kickoff_text(
        self, *, repo: str, start: datetime, end: datetime, line_count: int
    ) -> str: ...


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


class LokiErrors:
    """The Railway deployment's errors, read from Grafana Loki."""

    source = RAILWAY

    def __init__(self) -> None:
        self.grafana = GrafanaClient(
            url=os.environ["FACTORY_GRAFANA_URL"], token=os.environ["FACTORY_GRAFANA_TOKEN"]
        )
        self.logql = os.environ["FACTORY_GRAFANA_LOGQL"]
        self.datasource_uid = self.grafana.find_loki_datasource_uid(
            preferred_uid=os.environ.get("FACTORY_GRAFANA_LOKI_UID")
        )
        print(f"datasource={self.datasource_uid}")

    def count_errors(self, *, start: datetime, end: datetime) -> int:
        return self.grafana.count_loki_lines(
            datasource_uid=self.datasource_uid, logql=self.logql, start=start, end=end
        )

    def kickoff_text(self, *, repo: str, start: datetime, end: datetime, line_count: int) -> str:
        return (
            f"Triage the Phoenix server errors logged between {format_timestamp(start)} and "
            f"{format_timestamp(end)} into issues in {repo}. The Loki datasource UID is "
            f"{self.datasource_uid}. The LogQL that selects server errors is:\n\n{self.logql}\n\n"
            f"It matched {line_count} lines in the window."
        )


class DatadogErrors:
    """Phoenix Cloud's errors, counted through the Datadog Logs aggregate API."""

    source = CLOUD

    def __init__(self) -> None:
        self.site = os.environ.get("FACTORY_DATADOG_SITE") or DEFAULT_DATADOG_SITE
        self.token = os.environ["FACTORY_DATADOG_TOKEN"]
        self.query = os.environ["FACTORY_DATADOG_QUERY"]

    def count_errors(self, *, start: datetime, end: datetime) -> int:
        request = urllib.request.Request(
            f"https://api.{self.site}/api/v2/logs/analytics/aggregate",
            data=json.dumps(
                {
                    "compute": [{"aggregation": "count"}],
                    "filter": {
                        "query": self.query,
                        "from": str(int(start.timestamp() * 1000)),
                        "to": str(int(end.timestamp() * 1000)),
                    },
                }
            ).encode(),
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            result = json.load(response)
        buckets = result.get("data", {}).get("buckets", [])
        if not buckets:
            return 0
        return int(buckets[0]["computes"]["c0"])

    def kickoff_text(self, *, repo: str, start: datetime, end: datetime, line_count: int) -> str:
        return (
            f"Triage the Phoenix Cloud server errors logged between {format_timestamp(start)} "
            f"and {format_timestamp(end)} into issues in {repo}. The Datadog site is "
            f"{self.site}. The log search that selects server errors is:\n\n{self.query}\n\n"
            f"It matched {line_count} logs in the window."
        )


ERROR_STORES: dict[str, type[ErrorStore]] = {RAILWAY.name: LokiErrors, CLOUD.name: DatadogErrors}


def format_timestamp(moment: datetime) -> str:
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_timestamp(text: str) -> datetime:
    return datetime.fromisoformat(text.replace("Z", "+00:00"))


def start_triage_session(
    *,
    client: anthropic.Anthropic,
    source: TriageSource,
    repo: str,
    github_token: str,
    kickoff_text: str,
    window_end: datetime,
    budget_cents: int,
) -> str:
    lock = json.loads(LOCK_FILE_PATH.read_text())
    # Only maintainer-set values go in the prompt; the agent reads the untrusted log lines
    # itself through the source's MCP server.
    session = client.beta.sessions.create(
        agent=read_lock_id(lock=lock, lock_key=source.agent_lock_key),
        environment_id=read_lock_id(lock=lock, lock_key=ENVIRONMENT_LOCK_KEY),
        vault_ids=read_vault_ids(lock=lock),
        title=f"{source.name} triage: {repo} {window_end.strftime('%Y-%m-%d')}",
        metadata={"repo": repo, "lane": f"{source.name}-triage"},
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
                "description": TRIAGE_OUTCOME.format(repo=repo, label=source.label),
                "rubric": {"type": "text", "content": source.rubric_path.read_text()},
                "max_iterations": 2,
            },
        ],
    )
    return session.id


def list_source_issues(
    *, repo: str, label: str, token: str, since: datetime
) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = json.loads(
        run_gh(
            "issue",
            "list",
            "--repo",
            repo,
            "--label",
            label,
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
    parser.add_argument(
        "--source",
        choices=sorted(SOURCES),
        default=RAILWAY.name,
        help="Which deployment's errors to triage",
    )
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
    parser.add_argument("--dry-run", action="store_true", help="Count the errors and stop")
    args = parser.parse_args()

    store = ERROR_STORES[args.source]()
    source = store.source
    window_end = datetime.now(timezone.utc)
    window_start = window_end - timedelta(hours=args.hours, minutes=args.overlap_minutes)
    line_count = store.count_errors(start=window_start, end=window_end)
    print(
        f"source={source.name} window={format_timestamp(window_start)}"
        f"..{format_timestamp(window_end)} lines={line_count}"
    )
    summary = [
        f"## {source.heading}\n\n{line_count} error lines in the last {args.hours:g} hours\n\n"
    ]
    if line_count == 0 or args.dry_run:
        if line_count:
            print(f"dry run: would start a {source.name}-triage session")
        write_step_summary(summary)
        return

    client = anthropic.Anthropic()
    app_token = create_app_token(client=client, repo=args.repo)
    session_start = datetime.now(timezone.utc)
    session_id = start_triage_session(
        client=client,
        source=source,
        repo=args.repo,
        github_token=app_token.refresh(),
        kickoff_text=store.kickoff_text(
            repo=args.repo, start=window_start, end=window_end, line_count=line_count
        ),
        window_end=window_end,
        budget_cents=args.budget_cents,
    )
    print(f"session_id={session_id}")
    summary.append(f"Session {format_session_link(session_id=session_id)}\n\n")
    app_token.follow_session(session_id=session_id)

    session, idle_event = wait_for_session(
        client=client,
        app_token=app_token,
        session_id=session_id,
        previous_idle_event_id=None,
        deadline=time.monotonic() + args.watch_minutes * 60,
    )
    if session is None:
        summary.append(f"Still running after {args.watch_minutes} minutes.\n")
        write_step_summary(summary)
        raise SystemExit(
            f"The {source.name}-triage session is still running; see the Claude Console."
        )
    latest_outcome = session.outcome_evaluations[-1] if session.outcome_evaluations else None
    outcome_result = latest_outcome.result if latest_outcome else "not graded"
    stop_reason = idle_event.stop_reason.type if idle_event else "terminated"
    cost = format_cost(session=session)
    print(f"stop_reason={stop_reason} outcome={outcome_result} cost={cost}")
    summary.append(f"Ended with `{stop_reason}`, rubric `{outcome_result}`, cost {cost}\n\n")

    # The session files and comments as the factory app; find what it touched by time.
    touched_issues = list_source_issues(
        repo=args.repo, label=source.label, token=app_token.refresh(), since=session_start
    )
    for issue in sorted(touched_issues, key=lambda issue: issue["createdAt"]):
        is_new = parse_timestamp(issue["createdAt"]) >= session_start
        dispatch = is_new and not args.no_dispatch
        if dispatch:
            run_gh(
                "issue",
                "edit",
                str(issue["number"]),
                "--repo",
                args.repo,
                "--add-label",
                FACTORY_LABEL,
                token=app_token.refresh(),
            )
        verb = "filed" if is_new else "updated"
        suffix = ", labeled factory" if dispatch else ""
        print(f"{verb}{suffix} #{issue['number']}: {issue['title']}")
        summary.append(f"- {verb}{suffix}: [#{issue['number']}]({issue['url']}) {issue['title']}\n")
    if not touched_issues:
        summary.append("No issues filed or updated.\n")
    write_step_summary(summary)
    if stop_reason != "end_turn":
        raise SystemExit(f"The session stopped with {stop_reason}; see the Claude Console.")


if __name__ == "__main__":
    main()
