# /// script
# requires-python = ">=3.12"
# ///
"""Deploy one PR's preview image to Railway, or tear it down.

`deploy` creates or updates the service named for the PR in the project the token is
scoped to, points it at the image, waits for the deployment, and leaves one comment on
the PR with the URL and how to run the image locally. `teardown` deletes the service and
says so on the same comment. The Railway public API is used directly, so the workflow
needs no CLI and the token's reach is one project.
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
DEPLOYMENT_FINAL_STATUSES = {"SUCCESS", "FAILED", "CRASHED", "REMOVED"}
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


def configure_service(*, project_id: str, environment_id: str, service_id: str, image: str) -> None:
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
    railway(
        "mutation($input: VariableCollectionUpsertInput!) {"
        " variableCollectionUpsert(input: $input) }",
        input={
            "projectId": project_id,
            "environmentId": environment_id,
            "serviceId": service_id,
            "variables": {"PORT": str(PHOENIX_PORT), "PHOENIX_PORT": str(PHOENIX_PORT)},
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


def wait_for_deployment(deployment_id: str) -> str:
    deadline = time.monotonic() + DEPLOY_TIMEOUT_SECONDS
    status = "UNKNOWN"
    while time.monotonic() < deadline:
        data = railway("query($id: String!) { deployment(id: $id) { status } }", id=deployment_id)
        status = str(data["deployment"]["status"])
        print(f"deployment {deployment_id}: {status}", flush=True)
        if status in DEPLOYMENT_FINAL_STATUSES:
            return status
        time.sleep(10)
    return f"TIMEOUT after {status}"


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


def delete_service(service_id: str) -> None:
    railway("mutation($id: String!) { serviceDelete(id: $id) }", id=service_id)


def run_gh(*args: str, input_text: Optional[str] = None) -> str:
    return subprocess.run(
        ["gh", *args], capture_output=True, text=True, check=True, input=input_text
    ).stdout


def upsert_comment(*, pr_number: int, body: str) -> None:
    """Keep one preview comment per PR, found by its marker, so pushes edit rather than pile up."""
    body = f"{COMMENT_MARKER}\n{body}"
    comment_ids = run_gh(
        "api",
        "--paginate",
        f"repos/{{owner}}/{{repo}}/issues/{pr_number}/comments",
        "--jq",
        f".[] | select(.body | startswith({json.dumps(COMMENT_MARKER)})) | .id",
    ).split()
    if comment_ids:
        run_gh(
            "api",
            "--method",
            "PATCH",
            f"repos/{{owner}}/{{repo}}/issues/comments/{comment_ids[0]}",
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
    *, image: str, url: str, status: str, seed: str, head_sha: str, run_url: str, logs: str
) -> str:
    lines = [
        f"### Preview of {head_sha[:7]}",
        "",
    ]
    if status == "SUCCESS":
        lines += [f"Running at **{url}**. The database is fresh and the seed ran on startup."]
    else:
        lines += [f"The deployment ended with status `{status}`; see the [run]({run_url})."]
    lines += [
        "",
        f"Seed: {seed}.",
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
        print(f"created service {name} ({service_id})")
    configure_service(
        project_id=project_id,
        environment_id=environment_id,
        service_id=service_id,
        image=args.image,
    )
    domain = ensure_domain(
        project_id=project_id, environment_id=environment_id, service_id=service_id
    )
    deployment_id = deploy_service(environment_id=environment_id, service_id=service_id)
    status = wait_for_deployment(deployment_id)
    logs = "" if status == "SUCCESS" else read_deployment_logs(deployment_id)
    url = f"https://{domain}"
    upsert_comment(
        pr_number=args.pr,
        body=format_deploy_comment(
            image=args.image,
            url=url,
            status=status,
            seed=args.seed,
            head_sha=args.head_sha,
            run_url=args.run_url,
            logs=logs,
        ),
    )
    print(f"url={url}\nstatus={status}")
    return 0 if status == "SUCCESS" else 1


def run_teardown(args: argparse.Namespace) -> int:
    project_id, _ = read_token_scope()
    service_id = find_service(project_id=project_id, name=f"pr-{args.pr}")
    if service_id is None:
        print("no preview service to delete")
        return 0
    delete_service(service_id)
    upsert_comment(pr_number=args.pr, body="The preview for this PR has been torn down.")
    print(f"deleted service pr-{args.pr}")
    return 0


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
    teardown_parser.set_defaults(run=run_teardown)
    args = parser.parse_args()
    try:
        return int(args.run(args))
    except RailwayError as error:
        print(f"::error::Railway API: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
