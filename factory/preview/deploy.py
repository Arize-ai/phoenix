# /// script
# requires-python = ">=3.12"
# ///
"""Deploy PR previews to Railway or remove previews of closed and unlabeled PRs."""

import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from typing import Any, Optional

import seed_log
from gh import run_gh

RAILWAY_API_URL = "https://backboard.railway.com/graphql/v2"
PREVIEW_LABEL = "factory-preview"
PR_SERVICE_PATTERN = re.compile(r"^pr-(\d+)$")
PR_TAG_PATTERN = re.compile(r"^pr-(\d+)(?:-[0-9a-f]+)?$")
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
            "Project-Access-Token": os.environ["RAILWAY_TOKEN"],
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as error:
        raise RailwayError(f"HTTP {error.code}: {error.read().decode(errors='replace')}") from error
    except (urllib.error.URLError, TimeoutError) as error:
        raise RailwayError(f"request failed: {error}") from error
    except ValueError as error:
        raise RailwayError(f"response was not JSON: {error}") from error
    if payload.get("errors"):
        raise RailwayError(json.dumps(payload["errors"]))
    if "data" not in payload:
        raise RailwayError(f"response had no data: {json.dumps(payload)[:500]}")
    return dict(payload["data"])


def read_token_scope() -> tuple[str, str]:
    scope = railway("query { projectToken { projectId environmentId } }")["projectToken"]
    return scope["projectId"], scope["environmentId"]


def list_services(*, project_id: str) -> dict[str, str]:
    data = railway(
        "query($id: String!) { project(id: $id) { services { edges { node { id name } } } } }",
        id=project_id,
    )
    return {
        str(edge["node"]["name"]): str(edge["node"]["id"])
        for edge in data["project"]["services"]["edges"]
    }


def find_service(*, project_id: str, name: str) -> Optional[str]:
    return list_services(project_id=project_id).get(name)


def create_service(*, project_id: str, environment_id: str, name: str) -> str:
    data = railway(
        "mutation($input: ServiceCreateInput!) { serviceCreate(input: $input) { id } }",
        input={"projectId": project_id, "environmentId": environment_id, "name": name},
    )
    return str(data["serviceCreate"]["id"])


def set_variables(*, project_id: str, environment_id: str, service_id: str) -> None:
    railway(
        "mutation($input: VariableCollectionUpsertInput!) {"
        " variableCollectionUpsert(input: $input) }",
        input={
            "projectId": project_id,
            "environmentId": environment_id,
            "serviceId": service_id,
            "variables": {"PORT": str(PHOENIX_PORT), "PHOENIX_PORT": str(PHOENIX_PORT)},
            "skipDeploys": True,
        },
    )


def set_image(*, environment_id: str, service_id: str, image: str) -> None:
    railway(
        "mutation($serviceId: String!, $environmentId: String!,"
        " $input: ServiceInstanceUpdateInput!) {"
        " serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId,"
        " input: $input) }",
        serviceId=service_id,
        environmentId=environment_id,
        input={
            "source": {"image": image},
            "healthcheckPath": "/healthz",
            "restartPolicyType": "ON_FAILURE",
            "restartPolicyMaxRetries": 3,
        },
    )


def ensure_domain(*, project_id: str, environment_id: str, service_id: str) -> str:
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
            "targetPort": PHOENIX_PORT,
        },
    )
    return str(data["serviceDomainCreate"]["domain"])


def deploy_service(*, environment_id: str, service_id: str) -> None:
    railway(
        "mutation($serviceId: String!, $environmentId: String!)"
        " { serviceInstanceDeployV2(serviceId: $serviceId, environmentId: $environmentId) }",
        serviceId=service_id,
        environmentId=environment_id,
    )


def list_deployments(*, environment_id: str, service_id: str) -> list[dict[str, Any]]:
    """Newest deployments first."""
    data = railway(
        "query($input: DeploymentListInput!) {"
        " deployments(input: $input, first: 10) { edges { node { id status } } } }",
        input={"environmentId": environment_id, "serviceId": service_id},
    )
    return [dict(edge["node"]) for edge in data["deployments"]["edges"]]


def wait_for_deployment(
    *, environment_id: str, service_id: str, before: set[str]
) -> tuple[str, str]:
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
                if d["id"] not in before
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


def delete_service(service_id: str) -> None:
    railway("mutation($id: String!) { serviceDelete(id: $id) }", id=service_id)


def ghcr_package(image: str) -> tuple[str, str]:
    owner, _, package = image.removeprefix("ghcr.io/").partition("/")
    return owner, package.partition(":")[0]


def packages_api_root(owner: str) -> str:
    try:
        owner_type = run_gh("api", f"users/{owner}", "--jq", ".type").strip()
    except subprocess.CalledProcessError:
        owner_type = "Organization"
    return f"{'orgs' if owner_type == 'Organization' else 'users'}/{owner}/packages/container"


def list_image_versions(*, image: str) -> dict[str, list[str]]:
    owner, package = ghcr_package(image)
    root = packages_api_root(owner)
    try:
        lines = run_gh(
            "api",
            "--paginate",
            f"{root}/{package}/versions?per_page=100",
            "--jq",
            ".[] | {id: .id, tags: (.metadata.container.tags // [])}",
        ).splitlines()
    except subprocess.CalledProcessError as error:
        print(f"::warning::Could not list image versions: {error.stderr}")
        return {}
    versions = (json.loads(line) for line in lines if line.strip())
    return {str(version["id"]): [str(tag) for tag in version["tags"]] for version in versions}


def delete_image_version(*, image: str, version_id: str) -> bool:
    """GitHub refuses to delete a package's last tagged version."""
    owner, package = ghcr_package(image)
    try:
        run_gh(
            "api",
            "--method",
            "DELETE",
            f"{packages_api_root(owner)}/{package}/versions/{version_id}",
            "--silent",
        )
    except subprocess.CalledProcessError as error:
        print(f"::warning::Could not delete image version {version_id}: {error.stderr}")
        return False
    return True


def preview_wanted(pr_number: int) -> bool:
    pr = json.loads(run_gh("pr", "view", str(pr_number), "--json", "state,labels"))
    return pr["state"] == "OPEN" and any(label["name"] == PREVIEW_LABEL for label in pr["labels"])


def image_visibility(*, image: str) -> str:
    owner, package = ghcr_package(image)
    root = packages_api_root(owner)
    for attempt in range(3):
        try:
            return run_gh("api", f"{root}/{package}", "--jq", ".visibility").strip()
        except subprocess.CalledProcessError as error:
            print(f"::warning::Reading the package's visibility: {error.stderr}")
            time.sleep(5 * (attempt + 1))
    return "unknown"


def find_comment(*, pr_number: int) -> Optional[str]:
    comment_ids = run_gh(
        "api",
        "--paginate",
        f"repos/{{owner}}/{{repo}}/issues/{pr_number}/comments",
        "--jq",
        f".[] | select(.body | startswith({json.dumps(COMMENT_MARKER)})) | .id",
    ).split()
    return comment_ids[0] if comment_ids else None


def upsert_comment(*, pr_number: int, body: str, create: bool = True) -> None:
    body = f"{COMMENT_MARKER}\n{body}"
    comment_id = find_comment(pr_number=pr_number)
    if comment_id is None and not create:
        return
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


def format_deploy_comment(
    *,
    image: str,
    url: str,
    status: str,
    seed: str,
    seed_outcome: str,
    seed_output: str,
    head_sha: str,
    run_url: str,
    logs: str,
) -> str:
    lines = [f"### Preview of {head_sha[:7]}", ""]
    server_up = status == "SUCCESS" and seed_outcome not in (
        seed_log.UNHEALTHY_LINE,
        SEED_NOT_FINISHED_LINE,
    )
    if server_up:
        lines += [f"Running at **{url}** on a fresh database."]
    elif status == "SUCCESS":
        lines += [
            f"Railway deployed it, but the launcher's log says otherwise (below), so {url} may"
            f" not answer; see the [run]({run_url})."
        ]
    elif status.startswith("TIMEOUT"):
        lines += [
            f"The deployment was still going when the run stopped waiting ({status.lower()});"
            f" see the [run]({run_url}). It may yet come up at {url}, seeded on its own."
        ]
    else:
        lines += [
            f"The deployment ended with status `{status}`; see the [run]({run_url})."
            f" Whatever answers at {url} is the previous deployment, if there was one."
        ]
    seed_line = f"Seed: {seed}."
    if seed_outcome != seed_log.NO_SEED_LINE:
        seed_line += f" {seed_outcome.removeprefix('preview: ').capitalize()}."
    lines += ["", seed_line]
    if seed_output:
        lines += ["", "~~~", clip_for_comment(seed_output), "~~~"]
    lines += [
        "",
        "Run the same image locally:",
        "",
        "```",
        f"docker run --rm -p {PHOENIX_PORT}:{PHOENIX_PORT} {image}",
        "```",
    ]
    if status != "SUCCESS" and logs:
        lines += [
            "",
            "<details><summary>Deployment logs</summary>",
            "",
            "~~~",
            clip_for_comment(logs),
            "~~~",
            "",
            "</details>",
        ]
    return "\n".join(lines)


def run_deploy(args: argparse.Namespace) -> int:
    visibility = image_visibility(image=args.image)
    if visibility != "public":
        org, package = ghcr_package(args.image)
        problem = (
            f"GitHub would not say whether `{org}/{package}` is public, so the deploy did not"
            " start. Re-add the label to try again"
            if visibility == "unknown"
            else f"its package is {visibility}, so Railway can't pull it. A maintainer needs to"
            f" make `{org}/{package}` public once (see Bootstrap in factory/README.md), then"
            " re-add the label"
        )
        upsert_comment(
            pr_number=args.pr, body=f"The image for this preview was pushed, but {problem}."
        )
        print(f"::error::The preview image's package is {visibility}; see the PR comment.")
        return 1
    try:
        project_id, environment_id = read_token_scope()
        name = f"pr-{args.pr}"
        service_id = find_service(project_id=project_id, name=name)
        before: set[str] = set()
        if service_id is None:
            service_id = create_service(
                project_id=project_id, environment_id=environment_id, name=name
            )
            print(f"created service {name} ({service_id})")
        else:
            before = {
                str(d["id"])
                for d in list_deployments(environment_id=environment_id, service_id=service_id)
            }
        set_variables(project_id=project_id, environment_id=environment_id, service_id=service_id)
        set_image(environment_id=environment_id, service_id=service_id, image=args.image)
        domain = ensure_domain(
            project_id=project_id, environment_id=environment_id, service_id=service_id
        )
        if not preview_wanted(args.pr):
            print(f"PR #{args.pr} is closed or unlabeled, so nothing is deployed")
            return 0
        deploy_service(environment_id=environment_id, service_id=service_id)
        deployment_id, status = wait_for_deployment(
            environment_id=environment_id, service_id=service_id, before=before
        )
    except RailwayError as error:
        try:
            upsert_comment(
                pr_number=args.pr,
                body=(
                    f"### Preview of {args.head_sha[:7]}\n\nDeploying failed before Railway"
                    f" took the image; see the [run]({args.run_url}).\n\n~~~\n"
                    f"{clip_for_comment(str(error))}\n~~~"
                ),
            )
        except subprocess.CalledProcessError as comment_error:
            print(f"::warning::Could not update the PR comment: {comment_error.stderr}")
        raise
    logs = ""
    if status == "SUCCESS":
        seed_outcome, seed_output = wait_for_seed(deployment_id)
    else:
        seed_outcome, seed_output = "preview: the seed did not run", ""
        if deployment_id:
            log = LogTail(deployment_id)
            log.refresh()
            logs = log.tail(MAX_OUTPUT_LINES)
    url = f"https://{domain}"
    upsert_comment(
        pr_number=args.pr,
        body=format_deploy_comment(
            image=args.image,
            url=url,
            status=status,
            seed=args.seed,
            seed_outcome=seed_outcome,
            seed_output=seed_output,
            head_sha=args.head_sha,
            run_url=args.run_url,
            logs=logs,
        ),
    )
    print(f"url={url}\nstatus={status}\n{seed_outcome}")
    return 0 if status == "SUCCESS" and seed_outcome.startswith(seed_log.SUCCESS_LINES) else 1


def preview_numbers(*, services: dict[str, str], versions: dict[str, list[str]]) -> set[int]:
    numbers = {int(m.group(1)) for name in services if (m := PR_SERVICE_PATTERN.match(name))}
    for tags in versions.values():
        numbers |= {int(m.group(1)) for tag in tags if (m := PR_TAG_PATTERN.match(tag))}
    return numbers


def pr_version_ids(*, versions: dict[str, list[str]], pr_number: int) -> set[str]:
    return {
        version_id
        for version_id, tags in versions.items()
        if any((m := PR_TAG_PATTERN.match(tag)) and int(m.group(1)) == pr_number for tag in tags)
    }


def sweep_preview(
    *, pr_number: int, image: str, services: dict[str, str], versions: dict[str, list[str]]
) -> None:
    """Keep image tags if service deletion fails so the next sweep can retry."""
    if (service_id := services.get(f"pr-{pr_number}")) is not None:
        delete_service(service_id)
        print(f"deleted service pr-{pr_number}")
    deleted = sum(
        delete_image_version(image=image, version_id=version_id)
        for version_id in pr_version_ids(versions=versions, pr_number=pr_number)
    )
    print(f"deleted {deleted} image versions of PR #{pr_number}")
    if service_id is not None or deleted:
        upsert_comment(
            pr_number=pr_number, body="The preview for this PR has been torn down.", create=False
        )


def run_sweep(args: argparse.Namespace) -> int:
    project_id, _ = read_token_scope()
    services = list_services(project_id=project_id)
    versions = list_image_versions(image=args.image)
    failures = 0
    for pr_number in sorted(preview_numbers(services=services, versions=versions)):
        try:
            if preview_wanted(pr_number):
                continue
            sweep_preview(
                pr_number=pr_number, image=args.image, services=services, versions=versions
            )
        except subprocess.CalledProcessError as error:
            print(f"::warning::PR #{pr_number}: {error.stderr}")
            failures += 1
        except RailwayError as error:
            print(f"::error::PR #{pr_number}: Railway API: {error}", file=sys.stderr)
            failures += 1
    return 1 if failures else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    deploy_parser = subparsers.add_parser("deploy")
    deploy_parser.add_argument("--pr", type=int, required=True)
    deploy_parser.add_argument("--image", required=True, help="fully qualified image reference")
    deploy_parser.add_argument("--head-sha", required=True)
    deploy_parser.add_argument(
        "--seed", required=True, help="one line on the seed, for the comment"
    )
    deploy_parser.add_argument("--run-url", required=True)
    deploy_parser.set_defaults(run=run_deploy)
    sweep_parser = subparsers.add_parser("sweep")
    sweep_parser.add_argument("--image", required=True, help="GHCR image, without a tag")
    sweep_parser.set_defaults(run=run_sweep)
    args = parser.parse_args()
    try:
        return int(args.run(args))
    except RailwayError as error:
        print(f"::error::Railway API: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
