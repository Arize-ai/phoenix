# /// script
# requires-python = ">=3.12"
# ///
"""Deploy PR previews to Railway."""

import argparse
import base64
import json
import os
import re
import secrets
import subprocess
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any, Optional
from uuid import UUID

import seed_log
from gh import run_gh
from settings import BASELINE_OPTIONS, DATABASE_OPTIONS, PreviewSettings, parse_settings

RAILWAY_API_URL = "https://backboard.railway.com/graphql/v2"
PREVIEW_LABEL = "factory-preview"
PREVIEW_PROJECT_PREFIX = "phoenix-preview-pr-"
SWEEP_BATCH_SIZE = 256
PHOENIX_PORT = 6006
DEPLOY_TIMEOUT_SECONDS = 15 * 60
SKIPPED_GRACE_SECONDS = 120
LOG_LAG_ALLOWANCE_SECONDS = 120
SEED_WAIT_SECONDS = (
    seed_log.SEED_TIMEOUT_SECONDS + seed_log.RELAY_DRAIN_SECONDS + LOG_LAG_ALLOWANCE_SECONDS
)
# SKIPPED is not final: Railway replaced the deployment with one it queued itself.
DEPLOYMENT_FINAL_STATUSES = {
    "SUCCESS",
    "FAILED",
    "CRASHED",
    "REMOVED",
    "SLEEPING",
    "NEEDS_APPROVAL",
}
MAX_OUTPUT_LINES = 60
MAX_OUTPUT_CHARS = 8000
COMMENT_MARKER = "<!-- factory-preview -->"
SEED_NOT_FINISHED_LINE = "preview: the seed had not finished when the run stopped waiting"


class RailwayError(Exception):
    pass


def railway(query: str, **variables: Any) -> dict[str, Any]:
    body = json.dumps({"query": query, "variables": variables}).encode()
    request = urllib.request.Request(
        RAILWAY_API_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {os.environ['RAILWAY_API_TOKEN']}",
            "User-Agent": "phoenix-factory-preview",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as error:
        raise RailwayError(f"Railway returned HTTP {error.code}") from error
    except (urllib.error.URLError, TimeoutError) as error:
        raise RailwayError(f"request failed: {error}") from error
    except ValueError as error:
        raise RailwayError(f"response was not JSON: {error}") from error
    if payload.get("errors"):
        raise RailwayError("Railway rejected the GraphQL operation")
    if "data" not in payload:
        raise RailwayError("Railway response had no data")
    return dict(payload["data"])


@dataclass(frozen=True)
class PreviewProject:
    id: str
    environment_id: str


def project_marker(pr_number: int) -> str:
    return f"factory-preview:{os.environ['GH_REPO']}#{pr_number}"


def list_workspace_projects() -> list[dict[str, Any]]:
    workspace_id = str(UUID(os.environ["RAILWAY_WORKSPACE_ID"]))
    cursor = None
    projects: list[dict[str, Any]] = []
    while True:
        page = railway(
            """
            query($id: String!, $cursor: String) {
              workspace(workspaceId: $id) {
                projects(first: 50, after: $cursor) {
                  pageInfo { hasNextPage endCursor }
                  edges { node { id name description workspaceId environments {
                    edges { node { id name } }
                  } } }
                }
              }
            }
            """,
            id=workspace_id,
            cursor=cursor,
        )["workspace"]["projects"]
        projects.extend(edge["node"] for edge in page["edges"])
        if not page["pageInfo"]["hasNextPage"]:
            return projects
        cursor = page["pageInfo"]["endCursor"]


def owned_pr_number(project: dict[str, Any]) -> Optional[int]:
    workspace_id = str(UUID(os.environ["RAILWAY_WORKSPACE_ID"]))
    if project["workspaceId"] != workspace_id or not project["name"].startswith(
        PREVIEW_PROJECT_PREFIX
    ):
        return None
    suffix = project["name"].removeprefix(PREVIEW_PROJECT_PREFIX)
    if not re.fullmatch(r"[1-9][0-9]*", suffix):
        return None
    pr_number = int(suffix)
    return pr_number if project["description"] == project_marker(pr_number) else None


def find_owned_project(pr_number: int) -> Optional[dict[str, Any]]:
    matches = [
        project for project in list_workspace_projects() if owned_pr_number(project) == pr_number
    ]
    if len(matches) > 1:
        raise RailwayError(f"Multiple preview projects claim PR #{pr_number}")
    return matches[0] if matches else None


def find_project(pr_number: int) -> Optional[PreviewProject]:
    if not (project := find_owned_project(pr_number)):
        return None
    environments = [
        edge["node"]["id"]
        for edge in project["environments"]["edges"]
        if edge["node"]["name"] == "production"
    ]
    if len(environments) != 1:
        raise RailwayError(f"Preview project for PR #{pr_number} has no production environment")
    return PreviewProject(project["id"], environments[0])


def create_project(pr_number: int) -> PreviewProject:
    project = railway(
        """
        mutation($input: ProjectCreateInput!) {
          projectCreate(input: $input) {
            id environments { edges { node { id name } } }
          }
        }
        """,
        input={
            "workspaceId": str(UUID(os.environ["RAILWAY_WORKSPACE_ID"])),
            "name": f"{PREVIEW_PROJECT_PREFIX}{pr_number}",
            "description": project_marker(pr_number),
            "defaultEnvironmentName": "production",
        },
    )["projectCreate"]
    environment = next(
        edge["node"]
        for edge in project["environments"]["edges"]
        if edge["node"]["name"] == "production"
    )
    return PreviewProject(project["id"], environment["id"])


def list_services(project: PreviewProject) -> dict[str, str]:
    data = railway(
        "query($id: String!) { project(id: $id) { services { edges { node { id name } } } } }",
        id=project.id,
    )
    return {
        edge["node"]["name"]: edge["node"]["id"] for edge in data["project"]["services"]["edges"]
    }


def service_variables(*, project: PreviewProject, service_id: str) -> dict[str, str]:
    return railway(
        """
        query($project: String!, $environment: String!, $service: String!) {
          variables(projectId: $project, environmentId: $environment, serviceId: $service)
        }
        """,
        project=project.id,
        environment=project.environment_id,
        service=service_id,
    )["variables"]


def set_mcp_token(*, project: PreviewProject, service_id: str, token: str) -> None:
    railway(
        "mutation($input: VariableCollectionUpsertInput!) {"
        " variableCollectionUpsert(input: $input) }",
        input={
            "projectId": project.id,
            "environmentId": project.environment_id,
            "serviceId": service_id,
            "variables": {"GRAFANA_SERVICE_ACCOUNT_TOKEN": token},
        },
    )


def ensure_domain(*, project_id: str, environment_id: str, service_id: str, port: int) -> str:
    data = railway(
        "query($projectId: String!, $environmentId: String!, $serviceId: String!)"
        " { domains(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId)"
        " { serviceDomains { domain } } }",
        projectId=project_id,
        environmentId=environment_id,
        serviceId=service_id,
    )
    if service_domains := data["domains"]["serviceDomains"]:
        return str(service_domains[0]["domain"])
    data = railway(
        "mutation($input: ServiceDomainCreateInput!) {"
        " serviceDomainCreate(input: $input) { domain } }",
        input={
            "serviceId": service_id,
            "environmentId": environment_id,
            "targetPort": port,
        },
    )
    return str(data["serviceDomainCreate"]["domain"])


def list_deployments(*, environment_id: str, service_id: str) -> list[dict[str, Any]]:
    """Newest deployments first."""
    data = railway(
        "query($input: DeploymentListInput!) {"
        " deployments(input: $input, first: 10) { edges { node { id status meta } } } }",
        input={"environmentId": environment_id, "serviceId": service_id},
    )
    return [dict(edge["node"]) for edge in data["deployments"]["edges"]]


def wait_for_deployment(*, environment_id: str, service_id: str, image: str) -> tuple[str, str]:
    """Railway may replace a skipped deployment with one it queues itself."""
    deadline = time.monotonic() + DEPLOY_TIMEOUT_SECONDS
    deployment_id = ""
    all_skipped_since: Optional[float] = None
    while time.monotonic() < deadline:
        status = "PENDING"
        try:
            ours = [
                d
                for d in list_deployments(environment_id=environment_id, service_id=service_id)
                if (d.get("meta") or {}).get("image") == image
            ]
            live = [d for d in ours if d["status"] != "SKIPPED"]
            if live:
                deployment_id, status = str(live[0]["id"]), str(live[0]["status"])
                all_skipped_since = None
            elif ours:
                all_skipped_since = all_skipped_since or time.monotonic()
                if time.monotonic() - all_skipped_since > SKIPPED_GRACE_SECONDS:
                    return str(ours[0]["id"]), "SKIPPED"
        except RailwayError as error:
            print(f"::warning::Polling deployments: {error}", flush=True)
        print(f"deployment {deployment_id or '(pending)'}: {status}", flush=True)
        if status in DEPLOYMENT_FINAL_STATUSES:
            return deployment_id, status
        time.sleep(10)
    return deployment_id, f"TIMEOUT after {status}"


class LogTail:
    def __init__(self, deployment_id: str) -> None:
        self.deployment_id = deployment_id
        self.lines: list[str] = []
        self._last_timestamp = ""
        self._seen_at_last_timestamp = 0

    def refresh(self) -> None:
        variables: dict[str, Any] = {"id": self.deployment_id, "limit": 5000}
        if self._last_timestamp:
            variables["startDate"] = self._last_timestamp
        try:
            data = railway(
                "query($id: String!, $limit: Int!, $startDate: DateTime) {"
                " deploymentLogs(deploymentId: $id, limit: $limit, startDate: $startDate)"
                " { timestamp message } }",
                **variables,
            )
        except RailwayError as error:
            print(f"::warning::Reading deployment logs: {error}", flush=True)
            return
        entries = [
            (str(e["timestamp"]), str(e["message"]).rstrip()) for e in data["deploymentLogs"]
        ]
        entries.sort(key=lambda entry: entry[0])
        # startDate is inclusive: skip as many lines at that timestamp as were already taken.
        previous_timestamp, previous_seen = self._last_timestamp, self._seen_at_last_timestamp
        skipped = 0
        for timestamp, message in entries:
            if timestamp < previous_timestamp:
                continue
            if timestamp == previous_timestamp and skipped < previous_seen:
                skipped += 1
                continue
            if timestamp == self._last_timestamp:
                self._seen_at_last_timestamp += 1
            else:
                self._last_timestamp, self._seen_at_last_timestamp = timestamp, 1
            self.lines.append(message)

    def tail(self, count: int) -> str:
        return "\n".join(self.lines[-count:])


def wait_for_seed(deployment_id: str) -> tuple[str, str]:
    """Railway reports SUCCESS before seeding finishes; read the outcome from the log."""
    deadline = time.monotonic() + SEED_WAIT_SECONDS
    log = LogTail(deployment_id)
    while time.monotonic() < deadline:
        log.refresh()
        lines = log.lines
        starts = [i for i, line in enumerate(lines) if line == seed_log.START_LINE]
        outcomes = [i for i, line in enumerate(lines) if line.startswith(seed_log.OUTCOME_PREFIXES)]
        last_start = starts[-1] if starts else -1
        if outcomes and outcomes[-1] > last_start:
            output = [
                line.removeprefix(seed_log.OUTPUT_PREFIX)
                for line in lines[last_start + 1 :]
                if line.startswith(seed_log.OUTPUT_PREFIX)
            ]
            return lines[outcomes[-1]], "\n".join(output)
        time.sleep(10)
    return SEED_NOT_FINISHED_LINE, ""


def preview_wanted(
    pr_number: int, *, head_sha: Optional[str] = None, settings: Optional[PreviewSettings] = None
) -> bool:
    pr = json.loads(run_gh("pr", "view", str(pr_number), "--json", "state,labels,headRefOid,body"))
    if (
        pr["state"] != "OPEN"
        or (head_sha is not None and pr["headRefOid"] != head_sha)
        or not any(label["name"] == PREVIEW_LABEL for label in pr["labels"])
    ):
        return False
    try:
        return settings is None or parse_settings(pr["body"] or "") == settings
    except ValueError:
        return False


def find_comment(*, pr_number: int) -> Optional[str]:
    comment_ids = run_gh(
        "api",
        "--paginate",
        f"repos/{{owner}}/{{repo}}/issues/{pr_number}/comments",
        "--jq",
        f'.[] | select(.user.login == "github-actions[bot]") '
        f"| select(.body | startswith({json.dumps(COMMENT_MARKER)})) | .id",
    ).split()
    return comment_ids[0] if comment_ids else None


def upsert_comment(*, pr_number: int, body: str) -> None:
    body = f"{COMMENT_MARKER}\n{body}"
    comment_id = find_comment(pr_number=pr_number)
    if comment_id is not None:
        run_gh(
            "api",
            "--method",
            "PATCH",
            f"repos/{{owner}}/{{repo}}/issues/comments/{comment_id}",
            "--input",
            "-",
            "--silent",
            input_text=json.dumps({"body": body}),
        )
    else:
        run_gh(
            "api",
            f"repos/{{owner}}/{{repo}}/issues/{pr_number}/comments",
            "--input",
            "-",
            "--silent",
            input_text=json.dumps({"body": body}),
        )


def clip_for_comment(text: str) -> str:
    lines = [line.replace("~~~", "~ ~ ~") for line in text.splitlines()]
    if len(lines) > MAX_OUTPUT_LINES:
        lines = [f"... {len(lines) - MAX_OUTPUT_LINES} earlier lines omitted"] + lines[
            -MAX_OUTPUT_LINES:
        ]
    clipped = "\n".join(lines)
    if len(clipped) > MAX_OUTPUT_CHARS:
        clipped = "..." + clipped[-MAX_OUTPUT_CHARS:]
    return clipped


DASHBOARD_UID = "phoenix-preview-compare"


def allow_preview_removals(*, changes: list[dict[str, Any]], settings: PreviewSettings) -> bool:
    allowed = set()
    for revision in ("base", "head"):
        for engine in ("sqlite", "postgres"):
            if revision not in settings.revisions or engine not in settings.engines:
                name = f"phoenix-{revision}-{engine}"
                allowed.add(f"Delete service {name}")
                if engine == "postgres":
                    allowed.add(f"Delete database {name}-db")
    destructive = [change for change in changes if change["severity"] == "destructive"]
    if any(
        change["kind"] != "resource.delete" or change["summary"] not in allowed
        for change in destructive
    ):
        raise RailwayError("Railway plan would remove resources outside the disabled previews")
    return bool(destructive)


def apply_config(
    *,
    project: PreviewProject,
    args: argparse.Namespace,
    settings: PreviewSettings,
    grafana_password: str,
    mcp_caller_token: str,
) -> bool:
    railway_cli = str(Path.cwd() / "node_modules" / ".bin" / "railway")
    env = {
        **os.environ,
        "_": railway_cli,
        "PREVIEW_BASELINE": args.baseline,
        "PREVIEW_DATABASE": settings.database,
        "PREVIEW_DATABASE_SCHEMA": f"preview_{int(os.environ['GITHUB_RUN_ID'])}",
        "PREVIEW_GRAFANA_PASSWORD": grafana_password,
        "PREVIEW_MCP_CALLER_TOKEN": mcp_caller_token,
    }
    subprocess.run(
        [railway_cli, "link", "--project", project.id, "--environment", project.environment_id],
        check=True,
        env=env,
    )
    with TemporaryDirectory() as directory:
        plan_path = str(Path(directory) / "railway-plan.json")
        plan = subprocess.run(
            [railway_cli, "config", "plan", "--json", "--out", plan_path],
            check=True,
            env=env,
            stdout=subprocess.PIPE,
        )
        changes = json.loads(plan.stdout)["changeSet"]["changes"]
        can_remove = allow_preview_removals(changes=changes, settings=settings)
        if not preview_wanted(args.pr, head_sha=args.head_sha, settings=settings):
            return False
        command = [railway_cli, "config", "apply", "--plan", plan_path, "--yes"]
        if can_remove:
            command.append("--confirm-destructive")
        subprocess.run(command, check=True, env=env)
    return True


def grafana_request(
    *, domain: str, password: str, path: str, payload: Optional[dict[str, Any]] = None
) -> dict[str, Any]:
    credentials = base64.b64encode(f"admin:{password}".encode()).decode()
    request = urllib.request.Request(
        f"https://{domain}{path}",
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={"Authorization": f"Basic {credentials}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        return dict(json.load(response))


def configure_grafana(
    *, domain: str, password: str, needs_mcp_token: bool, settings: PreviewSettings
) -> Optional[str]:
    for attempt in range(60):
        try:
            grafana_request(domain=domain, password=password, path="/api/user")
            break
        except (urllib.error.URLError, TimeoutError):
            if attempt == 59:
                raise RailwayError("Grafana did not become reachable with preview credentials")
            time.sleep(5)

    panels = [
        {
            "id": revision_index * len(settings.engines) + engine_index + 1,
            "title": name,
            "type": "logs",
            "gridPos": {
                "h": 14,
                "w": 24 // len(settings.revisions),
                "x": revision_index * (24 // len(settings.revisions)),
                "y": engine_index * 14,
            },
            "datasource": {"type": "loki", "uid": "loki"},
            "targets": [
                {
                    "refId": "A",
                    "datasource": {"type": "loki", "uid": "loki"},
                    "expr": f'{{service_name="{name}"}}',
                    "queryType": "range",
                }
            ],
        }
        for revision_index, revision in enumerate(settings.revisions)
        for engine_index, engine in enumerate(settings.engines)
        for name in (f"phoenix-{revision}-{engine}",)
    ]
    grafana_request(
        domain=domain,
        password=password,
        path="/api/dashboards/db",
        payload={
            "dashboard": {
                "uid": DASHBOARD_UID,
                "title": "Phoenix Preview Logs",
                "schemaVersion": 39,
                "time": {"from": "now-1h", "to": "now"},
                "panels": panels,
            },
            "overwrite": True,
        },
    )
    if not needs_mcp_token:
        return None

    accounts = grafana_request(
        domain=domain, password=password, path="/api/serviceaccounts/search?query=factory-preview"
    )
    account = next(
        (
            account
            for account in accounts["serviceAccounts"]
            if account["name"] == "factory-preview"
        ),
        None,
    )
    if account is None:
        account = grafana_request(
            domain=domain,
            password=password,
            path="/api/serviceaccounts",
            payload={"name": "factory-preview", "role": "Viewer"},
        )
    token = grafana_request(
        domain=domain,
        password=password,
        path=f"/api/serviceaccounts/{int(account['id'])}/tokens",
        payload={"name": f"factory-preview-{secrets.token_hex(8)}"},
    )
    return str(token["key"])


@dataclass(frozen=True)
class PreviewResult:
    name: str
    url: str
    status: str
    seed_outcome: str
    seed_output: str

    @property
    def succeeded(self) -> bool:
        return self.status == "SUCCESS" and self.seed_outcome.startswith(seed_log.SUCCESS_LINES)


def read_result(
    *, project: PreviewProject, service_id: str, name: str, image: str
) -> PreviewResult:
    domain = ensure_domain(
        project_id=project.id,
        environment_id=project.environment_id,
        service_id=service_id,
        port=PHOENIX_PORT,
    )
    deployment_id, status = wait_for_deployment(
        environment_id=project.environment_id, service_id=service_id, image=image
    )
    outcome, output = (
        wait_for_seed(deployment_id)
        if status == "SUCCESS"
        else ("preview: the seed did not run", "")
    )
    return PreviewResult(name, f"https://{domain}", status, outcome, output)


def format_comment(
    *,
    args: argparse.Namespace,
    results: list[PreviewResult],
    settings: PreviewSettings,
    project: PreviewProject,
    grafana: str,
    mcp: str,
) -> str:
    title = f"### Preview of {args.head_sha[:7]}"
    if settings.include_baseline:
        title += f" against {args.base_sha[:7]}"
    columns = (
        ["Database", "Target commit", "PR commit"]
        if settings.include_baseline
        else ["Database", "PR commit"]
    )
    baseline = "on" if settings.include_baseline else "off"
    lines = [
        title,
        "",
        f"[Railway project](https://railway.com/project/{project.id}) · "
        f"[Compare logs](https://{grafana}/d/{DASHBOARD_UID}/phoenix-preview-logs) · "
        f"[Grafana MCP](https://{mcp}/mcp) · [Workflow run]({args.run_url})",
        "",
        f"Baseline: {baseline}. Database: {settings.database}. Seed: {args.seed}.",
        "",
        f"| {' | '.join(columns)} |",
        "| " + " | ".join("---" for _ in columns) + " |",
    ]
    by_name = {result.name: result for result in results}
    for engine in settings.engines:
        cells = []
        for revision in settings.revisions:
            result = by_name[f"phoenix-{revision}-{engine}"]
            outcome = result.seed_outcome.removeprefix("preview: ")
            cells.append(f"[Open]({result.url}) · {result.status.lower()}, {outcome}")
        lines.append(f"| {engine} | {' | '.join(cells)} |")
    for result in results:
        if result.seed_output:
            lines.extend(
                [
                    "",
                    f"<details><summary>{result.name} seed output</summary>",
                    "",
                    "~~~",
                    clip_for_comment(result.seed_output),
                    "~~~",
                    "",
                    "</details>",
                ]
            )
    return "\n".join(lines)


def run_deploy(args: argparse.Namespace) -> int:
    settings = PreviewSettings(include_baseline=args.baseline == "on", database=args.database)
    if not preview_wanted(args.pr, head_sha=args.head_sha, settings=settings):
        return 0
    project = find_project(args.pr) or create_project(args.pr)
    services = list_services(project)
    grafana_vars = (
        service_variables(project=project, service_id=services["lgtm"])
        if "lgtm" in services
        else {}
    )
    mcp_vars = (
        service_variables(project=project, service_id=services["grafana-mcp"])
        if "grafana-mcp" in services
        else {}
    )
    password = grafana_vars.get("GF_SECURITY_ADMIN_PASSWORD") or secrets.token_urlsafe(32)
    mcp_caller_token = mcp_vars.get("MCP_GRAFANA_SERVER_TOKEN") or secrets.token_urlsafe(32)
    if not apply_config(
        project=project,
        args=args,
        settings=settings,
        grafana_password=password,
        mcp_caller_token=mcp_caller_token,
    ):
        return 0
    services = list_services(project)
    selected = {
        f"phoenix-{revision}-{engine}": os.environ[f"PREVIEW_{revision.upper()}_IMAGE"]
        for revision in settings.revisions
        for engine in settings.engines
    }
    with ThreadPoolExecutor(max_workers=len(selected)) as executor:
        futures = [
            executor.submit(
                read_result, project=project, service_id=services[name], name=name, image=image
            )
            for name, image in selected.items()
        ]
        grafana = ensure_domain(
            project_id=project.id,
            environment_id=project.environment_id,
            service_id=services["lgtm"],
            port=3000,
        )
        mcp = ensure_domain(
            project_id=project.id,
            environment_id=project.environment_id,
            service_id=services["grafana-mcp"],
            port=8000,
        )
        if token := configure_grafana(
            domain=grafana,
            password=password,
            needs_mcp_token=not mcp_vars.get("GRAFANA_SERVICE_ACCOUNT_TOKEN"),
            settings=settings,
        ):
            set_mcp_token(project=project, service_id=services["grafana-mcp"], token=token)
        results = [future.result() for future in futures]
    if preview_wanted(args.pr, head_sha=args.head_sha, settings=settings):
        upsert_comment(
            pr_number=args.pr,
            body=format_comment(
                args=args,
                results=results,
                settings=settings,
                project=project,
                grafana=grafana,
                mcp=mcp,
            ),
        )
    return 0 if all(result.succeeded for result in results) else 1


def run_discover_cleanup(_args: argparse.Namespace) -> int:
    pr_numbers = {
        pr_number
        for project in list_workspace_projects()
        if (pr_number := owned_pr_number(project)) is not None
    }
    candidates = []
    for pr_number in sorted(pr_numbers):
        try:
            if not preview_wanted(pr_number):
                candidates.append(pr_number)
        except subprocess.CalledProcessError:
            print(f"::warning::Could not verify PR #{pr_number} for cleanup", file=sys.stderr)
    if len(candidates) > SWEEP_BATCH_SIZE:
        print(f"::warning::Deferring cleanup beyond {SWEEP_BATCH_SIZE} projects", file=sys.stderr)
    print(json.dumps(candidates[:SWEEP_BATCH_SIZE]))
    return 0


def run_cleanup(args: argparse.Namespace) -> int:
    if preview_wanted(args.pr):
        return 0
    if project := find_owned_project(args.pr):
        if preview_wanted(args.pr):
            return 0
        deleted = railway("mutation($id: String!) { projectDelete(id: $id) }", id=project["id"])
        if not deleted.get("projectDelete"):
            raise RailwayError(f"Railway did not delete the preview project for PR #{args.pr}")
        upsert_comment(pr_number=args.pr, body="The Factory Preview Railway project was removed.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    deploy_parser = subparsers.add_parser("deploy")
    deploy_parser.add_argument("--pr", type=int, required=True)
    deploy_parser.add_argument("--base-sha", required=True)
    deploy_parser.add_argument("--head-sha", required=True)
    deploy_parser.add_argument("--seed", required=True)
    deploy_parser.add_argument("--run-url", required=True)
    deploy_parser.add_argument("--baseline", choices=BASELINE_OPTIONS, default="on")
    deploy_parser.add_argument("--database", choices=DATABASE_OPTIONS, default="both")
    deploy_parser.set_defaults(run=run_deploy)
    discovery_parser = subparsers.add_parser("discover-cleanup")
    discovery_parser.set_defaults(run=run_discover_cleanup)
    cleanup_parser = subparsers.add_parser("cleanup")
    cleanup_parser.add_argument("--pr", type=int, required=True)
    cleanup_parser.set_defaults(run=run_cleanup)
    args = parser.parse_args()
    try:
        return int(args.run(args))
    except (RailwayError, urllib.error.URLError, subprocess.CalledProcessError) as error:
        print(f"::error::Preview {args.command} failed: {error}", file=sys.stderr)
        if args.command == "deploy" and preview_wanted(args.pr, head_sha=args.head_sha):
            upsert_comment(
                pr_number=args.pr,
                body=f"Factory Preview setup failed. See the [workflow run]({args.run_url}).",
            )
        return 1


if __name__ == "__main__":
    sys.exit(main())
