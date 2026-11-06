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

RAILWAY_API_URL = "https://backboard.railway.com/graphql/v2"
PHOENIX_PORT = 6006
DEPLOY_TIMEOUT_SECONDS = 15 * 60
SEED_TIMEOUT_SECONDS = 10 * 60
# SKIPPED means Railway superseded the deployment with one it queued itself, for example
# from the service's creation; the service's latest deployment is then the one to follow.
DEPLOYMENT_FINAL_STATUSES = {
    "SUCCESS",
    "FAILED",
    "CRASHED",
    "REMOVED",
    "SKIPPED",
    "SLEEPING",
    "NEEDS_APPROVAL",
}
# launch.py's outcome lines; everything but "finished" and "no seed" is a failure.
SEED_START_PREFIX = "preview: running"
SEED_SUCCESS_PREFIXES = ("preview: seed finished", "preview: no seed")
SEED_OUTCOME_PREFIXES = SEED_SUCCESS_PREFIXES + (
    "preview: seed failed",
    "preview: the server did not become healthy",
)
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
    """Once, on creation; skipDeploys keeps this from queuing a deployment of its own."""
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


def deploy_service(*, environment_id: str, service_id: str) -> str:
    data = railway(
        "mutation($serviceId: String!, $environmentId: String!)"
        " { serviceInstanceDeployV2(serviceId: $serviceId, environmentId: $environmentId) }",
        serviceId=service_id,
        environmentId=environment_id,
    )
    return str(data["serviceInstanceDeployV2"])


def active_deployment_id(*, environment_id: str, service_id: str) -> str:
    """The newest of the service's recent deployments that Railway did not skip."""
    data = railway(
        "query($input: DeploymentListInput!) {"
        " deployments(input: $input, first: 5) { edges { node { id status } } } }",
        input={"environmentId": environment_id, "serviceId": service_id},
    )
    for edge in data["deployments"]["edges"]:
        if edge["node"]["status"] != "SKIPPED":
            return str(edge["node"]["id"])
    return ""


def wait_for_deployment(
    *, deployment_id: str, environment_id: str, service_id: str
) -> tuple[str, str]:
    """Follow the deployment to a final status; return (deployment id, status).

    A deployment Railway skips in favor of one it queued itself, as on a new service, hands
    over to the service's newest unskipped deployment. A failed poll, including the moment
    after the request when the deployment does not exist yet, counts as pending.
    """
    deadline = time.monotonic() + DEPLOY_TIMEOUT_SECONDS
    status = "PENDING"
    while time.monotonic() < deadline:
        try:
            data = railway(
                "query($id: String!) { deployment(id: $id) { status } }", id=deployment_id
            )
            status = str(data["deployment"]["status"])
            if status == "SKIPPED":
                active = active_deployment_id(environment_id=environment_id, service_id=service_id)
                if active:
                    deployment_id = active
                    continue
        except RailwayError as error:
            print(f"::warning::Polling deployment {deployment_id}: {error}", flush=True)
            status = "PENDING"
        print(f"deployment {deployment_id}: {status}", flush=True)
        if status in DEPLOYMENT_FINAL_STATUSES:
            return deployment_id, status
        time.sleep(10)
    return deployment_id, f"TIMEOUT after {status}"


def read_deployment_logs(deployment_id: str, *, limit: int = 60) -> str:
    try:
        data = railway(
            "query($id: String!, $limit: Int!) {"
            " deploymentLogs(deploymentId: $id, limit: $limit) { message } }",
            id=deployment_id,
            limit=limit,
        )
    except RailwayError as error:
        return f"(logs unavailable: {error})"
    return "\n".join(entry["message"] for entry in data["deploymentLogs"])


def wait_for_seed(deployment_id: str) -> tuple[str, str]:
    """Return the launcher's seed outcome line and the seed's own output.

    Railway reports SUCCESS once /healthz answers, which launch.py reaches before the seed
    runs, so the comment waits for the launcher's outcome line rather than trusting SUCCESS.
    """
    deadline = time.monotonic() + SEED_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        # A failed read comes back as a one-line message, so it never matches an outcome.
        lines = read_deployment_logs(deployment_id, limit=500).splitlines()
        for index, line in enumerate(lines):
            if line.startswith(SEED_OUTCOME_PREFIXES):
                starts = [i for i in range(index) if lines[i].startswith(SEED_START_PREFIX)]
                output = lines[starts[-1] + 1 : index] if starts else []
                return line, "\n".join(output)
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
    version_ids = set(
        run_gh(
            "api",
            "--paginate",
            f"orgs/{org}/packages/container/{package}/versions?per_page=100",
            "--jq",
            f".[] | select(.metadata.container.tags[]? | {tag_filter}) | .id",
        ).split()
    )
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
        lines += ["", "```", seed_output, "```"]
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
            "```",
            logs,
            "```",
            "",
            "</details>",
        ]
    return "\n".join(lines)


def run_deploy(args: argparse.Namespace) -> int:
    project_id, environment_id = read_token_scope()
    name = f"pr-{args.pr}"
    service_id = find_service(project_id=project_id, name=name)
    if service_id is None:
        service_id = create_service(
            project_id=project_id, environment_id=environment_id, name=name, image=args.image
        )
        set_variables(project_id=project_id, environment_id=environment_id, service_id=service_id)
        print(f"created service {name} ({service_id})")
    set_image(environment_id=environment_id, service_id=service_id, image=args.image)
    domain = ensure_domain(
        project_id=project_id, environment_id=environment_id, service_id=service_id
    )
    deployment_id, status = wait_for_deployment(
        deployment_id=deploy_service(environment_id=environment_id, service_id=service_id),
        environment_id=environment_id,
        service_id=service_id,
    )
    if status == "SUCCESS":
        seed_outcome, seed_output = wait_for_seed(deployment_id)
        logs = ""
    else:
        seed_outcome, seed_output = "preview: the seed did not run", ""
        logs = read_deployment_logs(deployment_id)
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
    return 0 if status == "SUCCESS" and seed_outcome.startswith(SEED_SUCCESS_PREFIXES) else 1


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
