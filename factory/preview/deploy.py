# /// script
# requires-python = ">=3.12"
# ///
"""Deploy one PR's preview image to Railway, or tear it down.

`deploy` creates or updates the service named for the PR in the project the token is
scoped to, points it at the image, waits for the deployment and then for the seed's
outcome in the container log, and leaves one comment on the PR with the URL, the seed's
output and how to run the image locally. `teardown` deletes the service and the PR's image
tags from GHCR, and says so on the same comment. The Railway public API is used directly,
so the workflow needs no CLI and the token's reach is one project.
"""

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from typing import Any, Optional

import seed_log

RAILWAY_API_URL = "https://backboard.railway.com/graphql/v2"
PHOENIX_PORT = 6006
DEPLOY_TIMEOUT_SECONDS = 15 * 60
SEED_TIMEOUT_SECONDS = 10 * 60
# SKIPPED is not final here: Railway superseded the deployment with one it queued itself,
# for example from the service's creation, and that one is the one to follow.
DEPLOYMENT_FINAL_STATUSES = {
    "SUCCESS",
    "FAILED",
    "CRASHED",
    "REMOVED",
    "SLEEPING",
    "NEEDS_APPROVAL",
}
# GitHub caps a comment at 65536 characters; relayed output gets a fraction of that.
MAX_OUTPUT_LINES = 60
MAX_OUTPUT_CHARS = 8000
COMMENT_MARKER = "<!-- factory-preview -->"


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
    if payload.get("errors"):
        raise RailwayError(json.dumps(payload["errors"]))
    return dict(payload["data"])


def read_token_scope() -> tuple[str, str]:
    scope = railway("query { projectToken { projectId environmentId } }")["projectToken"]
    return scope["projectId"], scope["environmentId"]


def find_service(*, project_id: str, name: str) -> Optional[str]:
    data = railway(
        "query($id: String!) { project(id: $id) { services { edges { node { id name } } } } }",
        id=project_id,
    )
    for edge in data["project"]["services"]["edges"]:
        if edge["node"]["name"] == name:
            return str(edge["node"]["id"])
    return None


def create_service(*, project_id: str, environment_id: str, name: str, image: str) -> str:
    data = railway(
        "mutation($input: ServiceCreateInput!) { serviceCreate(input: $input) { id } }",
        input={
            "projectId": project_id,
            "environmentId": environment_id,
            "name": name,
            "source": {"image": image},
        },
    )
    return str(data["serviceCreate"]["id"])


def set_variables(*, project_id: str, environment_id: str, service_id: str) -> None:
    """Idempotent, so every deploy; skipDeploys keeps it from queuing a deployment of its own."""
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
    """The service's newest deployments, newest first."""
    data = railway(
        "query($input: DeploymentListInput!) {"
        " deployments(input: $input, first: 10) { edges { node { id status } } } }",
        input={"environmentId": environment_id, "serviceId": service_id},
    )
    return [dict(edge["node"]) for edge in data["deployments"]["edges"]]


def wait_for_deployment(
    *, environment_id: str, service_id: str, before: set[str]
) -> tuple[str, str]:
    """Follow this run's deployment to a final status; return (deployment id, status).

    Creating the service, and the deploy request, each queue a deployment, and Railway
    skips one in favor of the other, so rather than follow one id this follows the newest
    unskipped deployment that did not exist before this run started. One that is not
    listed yet, and a failed poll, count as pending.
    """
    deadline = time.monotonic() + DEPLOY_TIMEOUT_SECONDS
    deployment_id, status = "", "PENDING"
    while time.monotonic() < deadline:
        try:
            ours = [
                d
                for d in list_deployments(environment_id=environment_id, service_id=service_id)
                if d["id"] not in before and d["status"] != "SKIPPED"
            ]
            if ours:
                deployment_id, status = str(ours[0]["id"]), str(ours[0]["status"])
            else:
                status = "PENDING"
        except RailwayError as error:
            print(f"::warning::Polling deployments: {error}", flush=True)
            status = "PENDING"
        print(f"deployment {deployment_id or '(pending)'}: {status}", flush=True)
        if status in DEPLOYMENT_FINAL_STATUSES:
            return deployment_id, status
        time.sleep(10)
    return deployment_id, f"TIMEOUT after {status}"


class LogTail:
    """The deployment's log, accumulated across polls by asking only for new lines."""

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
        entries = [(str(e["timestamp"]), str(e["message"])) for e in data["deploymentLogs"]]
        # startDate is inclusive, so lines at the last timestamp come back; skip as many of
        # them as were already taken, which also handles identical lines.
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
    """Return the launcher's seed outcome line and the seed's own output.

    Railway reports SUCCESS once /healthz answers, which launch.py reaches before the seed
    runs, so the comment waits for the launcher's outcome line rather than trusting SUCCESS.
    The latest run is what counts: after a restart an earlier run's outcome is stale, and a
    run that has started but not finished is still pending. Output lines are taken from
    anywhere after the run started, so lines the relay flushed after the outcome count too.
    """
    deadline = time.monotonic() + SEED_TIMEOUT_SECONDS
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
    return "preview: the seed had not finished when the run stopped waiting", ""


def delete_service(service_id: str) -> None:
    railway("mutation($id: String!) { serviceDelete(id: $id) }", id=service_id)


def run_gh(*args: str, input_text: Optional[str] = None) -> str:
    return subprocess.run(
        ["gh", *args], capture_output=True, text=True, check=True, input=input_text
    ).stdout


def delete_image_tags(*, image: str, pr_number: int) -> int:
    """Delete every GHCR version tagged for this PR (pr-N and pr-N-*); return how many.

    GitHub refuses to delete a package's last tagged version, so a refusal is reported and
    skipped rather than failing the teardown.
    """
    org, _, package = image.removeprefix("ghcr.io/").partition("/")
    tag_filter = f'. == "pr-{pr_number}" or startswith("pr-{pr_number}-")'
    try:
        version_ids = set(
            run_gh(
                "api",
                "--paginate",
                f"orgs/{org}/packages/container/{package}/versions?per_page=100",
                "--jq",
                f".[] | select(.metadata.container.tags[]? | {tag_filter}) | .id",
            ).split()
        )
    except subprocess.CalledProcessError as error:
        # No package yet, when the PR never got as far as a push, or GHCR is unavailable.
        print(f"::warning::Could not list image versions: {error.stderr}")
        return 0
    deleted = 0
    for version_id in version_ids:
        try:
            run_gh(
                "api",
                "--method",
                "DELETE",
                f"orgs/{org}/packages/container/{package}/versions/{version_id}",
                "--silent",
            )
            deleted += 1
        except subprocess.CalledProcessError as error:
            print(f"::warning::Could not delete image version {version_id}: {error.stderr}")
    return deleted


def image_visibility(*, image: str) -> str:
    """`public`, `private` or `unknown` for the GHCR package behind the image.

    Railway needs a public package to pull without credentials. GHCR creates a package
    private on first push and only the web UI changes that, so the first run of a fresh
    package stops with instructions instead of a failed deploy. A lookup that keeps failing
    is `unknown`, which also stops the run: a wrong guess here costs the 15-minute wait and
    a misleading comment.
    """
    org, _, package = image.removeprefix("ghcr.io/").partition("/")
    package = package.partition(":")[0]
    for attempt in range(3):
        try:
            return run_gh(
                "api", f"orgs/{org}/packages/container/{package}", "--jq", ".visibility"
            ).strip()
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
    """Keep one preview comment per PR, found by its marker, so pushes edit rather than pile up.

    Without `create`, a PR that never had a preview comment gets none.
    """
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
    """The tail of some output, sized for a comment, with any fence of its own defused."""
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
    if status == "SUCCESS":
        lines += [f"Running at **{url}** on a fresh database."]
    else:
        lines += [f"The deployment ended with status `{status}`; see the [run]({run_url})."]
    lines += ["", f"Seed: {seed}. {seed_outcome.removeprefix('preview: ').capitalize()}."]
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
        package = args.image.partition(":")[0]
        problem = (
            f"its package is private, so Railway can't pull it. A maintainer needs to make"
            f" `{package}` public once (see Bootstrap in factory/README.md), then re-add the label"
            if visibility == "private"
            else f"GitHub would not say whether `{package}` is public, so the deploy did not"
            " start. Re-add the label to try again"
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
                project_id=project_id, environment_id=environment_id, name=name, image=args.image
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
        deploy_service(environment_id=environment_id, service_id=service_id)
        deployment_id, status = wait_for_deployment(
            environment_id=environment_id, service_id=service_id, before=before
        )
    except RailwayError as error:
        # The previous push's comment would otherwise go on advertising its instance.
        upsert_comment(
            pr_number=args.pr,
            body=(
                f"### Preview of {args.head_sha[:7]}\n\nDeploying failed before Railway took"
                f" the image; see the [run]({args.run_url}).\n\n~~~\n"
                f"{clip_for_comment(str(error))}\n~~~"
            ),
        )
        raise
    if status == "SUCCESS":
        seed_outcome, seed_output = wait_for_seed(deployment_id)
        logs = ""
    else:
        seed_outcome, seed_output = "preview: the seed did not run", ""
        logs = ""
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


def run_teardown(args: argparse.Namespace) -> int:
    """Delete the service, then the PR's image tags and the comment whatever Railway did."""
    railway_error: Optional[RailwayError] = None
    try:
        project_id, _ = read_token_scope()
        service_id = find_service(project_id=project_id, name=f"pr-{args.pr}")
        if service_id is None:
            print("no preview service to delete")
        else:
            delete_service(service_id)
            print(f"deleted service pr-{args.pr}")
    except RailwayError as error:
        railway_error = error
        print(f"::error::Railway API: {error}", file=sys.stderr)
    deleted_tags = delete_image_tags(image=args.image, pr_number=args.pr)
    print(f"deleted {deleted_tags} image versions")
    body = (
        "The preview for this PR has been torn down."
        if railway_error is None
        else "The preview's image tags were removed, but deleting its Railway service failed;"
        " see the workflow run."
    )
    upsert_comment(pr_number=args.pr, body=body, create=False)
    return 0 if railway_error is None else 1


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
    teardown_parser = subparsers.add_parser("teardown")
    teardown_parser.add_argument("--pr", type=int, required=True)
    teardown_parser.add_argument("--image", required=True, help="GHCR image, without a tag")
    teardown_parser.set_defaults(run=run_teardown)
    args = parser.parse_args()
    try:
        return int(args.run(args))
    except RailwayError as error:
        print(f"::error::Railway API: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
