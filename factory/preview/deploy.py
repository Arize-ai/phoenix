# /// script
# requires-python = ">=3.12"
# ///
"""Deploy one PR's preview image to Railway, or tear it down.

`deploy` creates or updates the service named for the PR in the project the token is
scoped to, points it at the image, waits for the deployment and then for the seed's
outcome in the container log, and leaves one comment on the PR with the URL, the seed's
output and how to run the image locally. `teardown` deletes the service and, except for the
newest when the PR merely lost its label, the PR's image tags from GHCR, and says so on the
same comment. The Railway public API is used directly,
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
from gh import error as log_error
from gh import ghcr_package, packages_api_root, preview_image, run_gh, set_output, warn

RAILWAY_API_URL = "https://backboard.railway.com/graphql/v2"
PHOENIX_PORT = 6006
DEPLOY_TIMEOUT_SECONDS = 15 * 60
SKIPPED_GRACE_SECONDS = 120
# The service restarts a crashed container (ON_FAILURE, three tries), so CRASHED is final
# only once it has stood this long without the status moving on.
CRASHED_GRACE_SECONDS = 180
# The launcher's own budget, its drain, and two minutes for the log to catch up.
SEED_WAIT_SECONDS = seed_log.SEED_TIMEOUT_SECONDS + seed_log.RELAY_DRAIN_SECONDS + 120
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
# The workflow's token posts as this login; a marker in anyone else's comment is ignored.
COMMENT_AUTHOR = "github-actions[bot]"
PREVIEW_LABEL = "factory-preview"
SEED_NOT_FINISHED_LINE = "preview: the seed had not finished when the run stopped waiting"
SEED_OUTCOME_GONE_LINE = "preview: the seed's outcome is no longer in the log"
# The launcher never reported the seed starting: the server did not come up for it, or
# the launcher's lines never reached the log.
SEED_NOT_STARTED_LINE = "preview: the seed had not started when the run stopped waiting"
LOG_UNREADABLE_LINE = "preview: the container log could not be read, so the seed is unverified"


def seed_is_fine(outcome: str) -> bool:
    """Whether a seed outcome is no cause for failure.

    A seed still running when the wait ended is the log lagging, and one whose lines have
    scrolled out of an old deployment's log is unknowable, not failed.
    """
    return outcome.startswith(seed_log.SUCCESS_LINES) or outcome in (
        SEED_NOT_FINISHED_LINE,
        SEED_OUTCOME_GONE_LINE,
    )


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


def required(data: dict[str, Any], key: str) -> Any:
    """A field Railway must have answered with; a null is an error, not a crash elsewhere."""
    if data.get(key) is None:
        raise RailwayError(f"Railway returned no {key}: {json.dumps(data)[:500]}")
    return data[key]


def read_token_scope() -> tuple[str, str]:
    scope = required(railway("query { projectToken { projectId environmentId } }"), "projectToken")
    return scope["projectId"], scope["environmentId"]


def find_service(*, project_id: str, name: str) -> Optional[str]:
    data = railway(
        "query($id: String!) { project(id: $id) { services { edges { node { id name } } } } }",
        id=project_id,
    )
    for edge in required(data, "project")["services"]["edges"]:
        node = edge.get("node") or {}
        if node.get("name") == name:
            return str(node["id"])
    return None


def create_service(*, project_id: str, environment_id: str, name: str) -> str:
    """An empty service: with no source nothing deploys until the settings are in place."""
    data = railway(
        "mutation($input: ServiceCreateInput!) { serviceCreate(input: $input) { id } }",
        input={"projectId": project_id, "environmentId": environment_id, "name": name},
    )
    return str(required(data, "serviceCreate")["id"])


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
    if service_domains := required(data, "domains")["serviceDomains"]:
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
    return str(required(data, "serviceDomainCreate")["domain"])


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
        " deployments(input: $input, first: 10) { edges { node { id status meta } } } }",
        input={"environmentId": environment_id, "serviceId": service_id},
    )
    return [
        dict(edge["node"]) for edge in required(data, "deployments")["edges"] if edge.get("node")
    ]


def wait_for_deployment(
    *, environment_id: str, service_id: str, before: set[str]
) -> tuple[str, str]:
    """Follow this run's deployment to a final status; return (deployment id, status).

    Railway may skip a deployment in favor of one it queues itself, so rather than follow
    one id this follows the newest unskipped deployment that did not exist before this run
    started. One that is not listed yet, and a failed poll, count as pending; a run whose
    every deployment stays skipped for SKIPPED_GRACE_SECONDS is over.
    """
    deadline = time.monotonic() + DEPLOY_TIMEOUT_SECONDS
    deployment_id = ""
    observed = "PENDING"
    all_skipped_since: Optional[float] = None
    crashed_since: Optional[float] = None
    while time.monotonic() < deadline:
        status = "PENDING"
        polled = False
        try:
            ours = [
                d
                for d in list_deployments(environment_id=environment_id, service_id=service_id)
                if d["id"] not in before
            ]
            polled = True
            live = [d for d in ours if d["status"] != "SKIPPED"]
            if live:
                deployment_id, status = str(live[0]["id"]), str(live[0]["status"])
                all_skipped_since = None
            elif ours:
                all_skipped_since = all_skipped_since or time.monotonic()
                if time.monotonic() - all_skipped_since > SKIPPED_GRACE_SECONDS:
                    return str(ours[0]["id"]), "SKIPPED"
        except RailwayError as error:
            warn(f"Polling deployments: {error}")
        print(f"deployment {deployment_id or '(pending)'}: {status}", flush=True)
        observed = status
        if status == "CRASHED":
            crashed_since = crashed_since or time.monotonic()
            if time.monotonic() - crashed_since <= CRASHED_GRACE_SECONDS:
                status = "PENDING"  # a restart may still bring it up
        elif polled:
            crashed_since = None  # only a real observation ends a crash
        if status in DEPLOYMENT_FINAL_STATUSES:
            return deployment_id, status
        time.sleep(10)
    return deployment_id, f"TIMEOUT after {observed}"


class LogTail:
    """The deployment's log, accumulated across polls by asking only for new lines."""

    def __init__(self, deployment_id: str) -> None:
        self.deployment_id = deployment_id
        self.lines: list[str] = []
        self.reads = 0  # successful fetches, so an unreadable log is told from a quiet one
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
        except RailwayError as failure:
            warn(f"Reading deployment logs: {failure}")
            return
        try:
            raw = required(data, "deploymentLogs")
        except RailwayError as failure:
            warn(f"Reading deployment logs: {failure}")
            return
        # Trailing whitespace or a carriage return would defeat the exact match on the
        # launcher's lines.
        self.reads += 1
        entries = [(str(e["timestamp"]), str(e["message"]).rstrip()) for e in raw]
        entries.sort(key=lambda entry: entry[0])  # stable, so same-timestamp order holds
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


def read_build_logs(deployment_id: str) -> str:
    """The tail of the build log, where an image that could not be pulled says why."""
    try:
        data = railway(
            "query($id: String!, $limit: Int!) {"
            " buildLogs(deploymentId: $id, limit: $limit) { message } }",
            id=deployment_id,
            limit=5000,
        )
        entries = required(data, "buildLogs")
    except RailwayError as failure:
        return f"(build logs unavailable: {failure})"
    return "\n".join(str(entry["message"]).rstrip() for entry in entries[-MAX_OUTPUT_LINES:])


def seed_state(log: LogTail) -> tuple[str, str, str]:
    """(state, outcome line, seed output) for the latest container attempt in the log.

    `done` carries the launcher's outcome line; `running` means the seed started and has
    not finished; `starting` means the launcher is up but the server has not answered yet;
    `unknown` means the launcher's lines are not in the log at all.
    """
    launches = [i for i, line in enumerate(log.lines) if line == seed_log.LAUNCH_LINE]
    lines = log.lines[launches[-1] + 1 :] if launches else log.lines
    starts = [i for i, line in enumerate(lines) if line == seed_log.START_LINE]
    outcomes = [i for i, line in enumerate(lines) if line.startswith(seed_log.OUTCOME_PREFIXES)]
    last_start = starts[-1] if starts else -1
    if outcomes and outcomes[-1] > last_start:
        output = [
            line.removeprefix(seed_log.OUTPUT_PREFIX)
            for line in lines[last_start + 1 :]
            if line.startswith(seed_log.OUTPUT_PREFIX)
        ]
        return "done", lines[outcomes[-1]], "\n".join(output)
    if starts:
        return "running", "", ""
    return ("starting" if launches else "unknown"), "", ""


def wait_for_seed(deployment_id: str, *, timeout: float = SEED_WAIT_SECONDS) -> tuple[str, str]:
    """Return the launcher's seed outcome line and the seed's own output.

    Railway reports SUCCESS once /healthz answers, which launch.py reaches before the seed
    runs, so the comment waits for the launcher's outcome line rather than trusting SUCCESS.
    The latest container attempt is what counts: after a restart an earlier attempt's
    outcome is stale, and one that has started but not finished is still pending.
    """
    deadline = time.monotonic() + timeout
    log = LogTail(deployment_id)
    while True:
        log.refresh()
        state, outcome, output = seed_state(log)
        if state == "done":
            return outcome, output
        if time.monotonic() >= deadline:
            if not log.reads:
                return LOG_UNREADABLE_LINE, ""
            return SEED_NOT_FINISHED_LINE if state == "running" else SEED_NOT_STARTED_LINE, ""
        time.sleep(10)


def delete_service(service_id: str) -> None:
    railway("mutation($id: String!) { serviceDelete(id: $id) }", id=service_id)


def delete_image_tags(
    *, image: str, pr_number: int, keep: str = "", keep_latest: bool = False
) -> int:
    """Delete the GHCR versions tagged for this PR (pr-N-*), and any untagged orphan;
    return how many.

    With `keep`, the version carrying that tag stays, so a deploy prunes the images it
    superseded; with `keep_latest`, the newest version stays, so an unlabeled PR keeps one
    image for a re-label to find. GitHub refuses to delete a package's last tagged version,
    so a refusal is reported and skipped rather than failing the teardown.
    """
    owner, package = ghcr_package(image)
    root = packages_api_root(owner)
    ours = f'any(.metadata.container.tags[]?; startswith("pr-{pr_number}-"))'
    if keep:
        ours += f" and (any(.metadata.container.tags[]?; . == {json.dumps(keep)}) | not)"
    # A version with no tag at all is the orphan of a tag that was pushed again, whichever
    # PR did it; nothing ever refers to it by digest.
    untagged = "((.metadata.container.tags // []) | length) == 0"
    try:
        listed = run_gh(
            "api",
            "--paginate",
            f"{root}/{package}/versions?per_page=100",
            "--jq",
            f".[] | select(({ours}) or ({untagged}))"
            f" | [.id, .created_at, ({untagged} | tostring)] | @tsv",
        ).splitlines()
        rows = [line.split("\t") for line in listed if line.strip()]
        tagged = sorted((row for row in rows if row[2] != "true"), key=lambda row: row[1])
        version_ids = {row[0] for row in rows if row[2] == "true"}
        version_ids |= {row[0] for row in (tagged[:-1] if keep_latest else tagged)}
    except subprocess.CalledProcessError as error:
        # No package yet, when the PR never got as far as a push, or GHCR is unavailable.
        warn(f"Could not list image versions: {error.stderr}")
        return 0
    deleted = 0
    for version_id in version_ids:
        try:
            run_gh(
                "api",
                "--method",
                "DELETE",
                f"{root}/{package}/versions/{version_id}",
                "--silent",
            )
            deleted += 1
        except subprocess.CalledProcessError as error:
            warn(f"Could not delete image version {version_id}: {error.stderr}")
    return deleted


def image_visibility(*, image: str) -> str:
    """`public`, `private` or `unknown` for the GHCR package behind the image.

    Railway needs a public package to pull without credentials. GHCR creates a package
    private on first push and only the web UI changes that, so the first run of a fresh
    package stops with instructions instead of a failed deploy. A lookup that keeps failing
    is `unknown`, which also stops the run: a wrong guess here costs the 15-minute wait and
    a misleading comment.
    """
    owner, package = ghcr_package(image)
    root = packages_api_root(owner)
    for attempt in range(3):
        try:
            return run_gh("api", f"{root}/{package}", "--jq", ".visibility").strip()
        except subprocess.CalledProcessError as error:
            warn(f"Reading the package's visibility: {error.stderr}")
            time.sleep(5 * (attempt + 1))
    return "unknown"


def find_comment(*, pr_number: int) -> Optional[str]:
    comment_ids = run_gh(
        "api",
        "--paginate",
        f"repos/{{owner}}/{{repo}}/issues/{pr_number}/comments",
        "--jq",
        f".[] | select(.user.login == {json.dumps(COMMENT_AUTHOR)})"
        f" | select(.body | startswith({json.dumps(COMMENT_MARKER)})) | .id",
    ).split()
    return comment_ids[0] if comment_ids else None


def upsert_comment(*, pr_number: int, body: str, create: bool = True) -> None:
    """Keep one preview comment per PR, found by its marker, so pushes edit rather than pile up.

    Without `create`, a PR that never had a preview comment gets none. Once the comment is
    posted, the step learns through its `reported` output that a report was made.
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
    set_output("reported", "true")


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
    fresh: bool = True,
) -> str:
    lines = [f"### Preview of {head_sha[:7]}", ""]
    server_down = seed_outcome in (seed_log.UNHEALTHY_LINE, SEED_NOT_STARTED_LINE)
    if status == "SUCCESS" and not server_down:
        lines += [
            f"Running at **{url}** on a fresh database."
            if fresh
            else f"Running at **{url}** since an earlier deploy of this same image, with"
            " whatever has been added to it since."
        ]
    elif status == "SUCCESS":
        lines += [
            f"Railway deployed it, but the launcher's log says the server is not up (below),"
            f" so {url} may not answer; see the [run]({run_url})."
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


def post_deploy_comment(
    *,
    args: argparse.Namespace,
    image: str,
    url: str,
    status: str,
    seed_outcome: str,
    seed_output: str,
    logs: str,
    fresh: bool = True,
) -> None:
    upsert_comment(
        pr_number=args.pr,
        body=format_deploy_comment(
            image=image,
            url=url,
            status=status,
            seed=args.seed,
            seed_outcome=seed_outcome,
            seed_output=seed_output,
            head_sha=args.head_sha,
            run_url=args.run_url,
            logs=logs,
            fresh=fresh,
        ),
    )


def reuse_existing_deployment(
    *,
    args: argparse.Namespace,
    image: str,
    project_id: str,
    environment_id: str,
    service_id: str,
    deployments: list[dict[str, Any]],
) -> bool:
    """Bring the comment up to date and return True when the service already runs this
    image from a successful deployment whose seed did not fail.

    The workflow skips the build when the image exists but runs deploy.py regardless, so a
    run whose deploy did not complete is retried by re-labeling; this is the case where
    there is nothing to redo. A seed still running gets the usual wait; one whose lines
    have scrolled out of an old deployment's log is taken as fine, which is no reason to
    redeploy; a failed one gets a fresh database.
    """
    live = [d for d in deployments if d["status"] != "SKIPPED"]
    if not live or live[0]["status"] != "SUCCESS":
        return False
    # The deployment's own record of what it runs, not the service's staged source, which
    # a run that set the image and then failed to deploy would have left pointing here.
    if (live[0].get("meta") or {}).get("image") != image:
        return False
    log = LogTail(str(live[0]["id"]))
    log.refresh()
    state, seed_outcome, seed_output = seed_state(log)
    if state in ("running", "starting"):
        seed_outcome, seed_output = wait_for_seed(str(live[0]["id"]))
    elif state == "unknown":
        seed_outcome = SEED_OUTCOME_GONE_LINE
    if not seed_is_fine(seed_outcome):
        print(f"{image} is deployed but its seed did not succeed; redeploying")
        return False
    domain = ensure_domain(
        project_id=project_id, environment_id=environment_id, service_id=service_id
    )
    post_deploy_comment(
        args=args,
        image=image,
        url=f"https://{domain}",
        status="SUCCESS",
        seed_outcome=seed_outcome,
        seed_output=seed_output,
        logs="",
        fresh=False,
    )
    print(f"{image} is already deployed; comment refreshed")
    settle_quietly(pr_number=args.pr, service_id=service_id)
    return True


def run_deploy(args: argparse.Namespace) -> int:
    image = f"{preview_image()}:{args.image_tag}"
    try:
        project_id, environment_id = read_token_scope()
        name = f"pr-{args.pr}"
        service_id = find_service(project_id=project_id, name=name)
        visibility = image_visibility(image=image)
        if visibility == "unknown" and service_id is not None:
            # An earlier run pulled from this package, so a lookup that fails now is
            # GitHub's trouble, not the package's; stopping would only unadvertise a
            # running preview.
            warn("Could not read the package's visibility; deploying anyway")
        elif visibility != "public":
            org, package = ghcr_package(image)
            problem = (
                f"GitHub would not say whether `{org}/{package}` is public, so the deploy did"
                " not start. Re-add the label to try again"
                if visibility == "unknown"
                else f"its package is {visibility}, so Railway can't pull it. A maintainer needs"
                f" to make `{org}/{package}` public once (see Bootstrap in factory/README.md),"
                " then re-add the label"
            )
            upsert_comment(
                pr_number=args.pr, body=f"The image for this preview was pushed, but {problem}."
            )
            log_error(f"The preview image's package is {visibility}; see the PR comment.")
            return 1

        before: set[str] = set()
        if service_id is None:
            service_id = create_service(
                project_id=project_id, environment_id=environment_id, name=name
            )
            print(f"created service {name} ({service_id})")
        else:
            deployments = list_deployments(environment_id=environment_id, service_id=service_id)
            before = {str(d["id"]) for d in deployments}
            if reuse_existing_deployment(
                args=args,
                image=image,
                project_id=project_id,
                environment_id=environment_id,
                service_id=service_id,
                deployments=deployments,
            ):
                return 0
        set_variables(project_id=project_id, environment_id=environment_id, service_id=service_id)
        set_image(environment_id=environment_id, service_id=service_id, image=image)
        domain = ensure_domain(
            project_id=project_id, environment_id=environment_id, service_id=service_id
        )
        deploy_service(environment_id=environment_id, service_id=service_id)
        deployment_id, status = wait_for_deployment(
            environment_id=environment_id, service_id=service_id, before=before
        )
    except RailwayError as error:
        # The previous push's comment would otherwise go on advertising its instance. A
        # failure to say so must not hide the Railway error itself.
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
            warn(f"Could not update the PR comment: {comment_error.stderr}")
        raise
    logs = ""
    if status == "SUCCESS":
        seed_outcome, seed_output = wait_for_seed(deployment_id)
        pruned = delete_image_tags(image=image, pr_number=args.pr, keep=args.image_tag)
        print(f"pruned {pruned} superseded image versions")
    else:
        seed_outcome, seed_output = "preview: the seed did not run", ""
        if deployment_id:
            log = LogTail(deployment_id)
            log.refresh()
            # No runtime log means the container never started; the build log says why.
            logs = log.tail(MAX_OUTPUT_LINES) or read_build_logs(deployment_id)
    post_deploy_comment(
        args=args,
        image=image,
        url=f"https://{domain}",
        status=status,
        seed_outcome=seed_outcome,
        seed_output=seed_output,
        logs=logs,
    )
    print(f"status={status}\n{seed_outcome}")
    settle_quietly(pr_number=args.pr, service_id=service_id)
    return 0 if status == "SUCCESS" and seed_is_fine(seed_outcome) else 1


def tear_down(*, pr_number: int, service_id: Optional[str], keep_latest_image: bool) -> str:
    """Delete the service and the PR's image tags; return the sentence for the comment.

    With `keep_latest_image` the newest image stays, so a re-label, which is how a failed
    run is retried, finds it built and skips the Docker steps.
    """
    if service_id is None:
        print("no preview service to delete")
    else:
        delete_service(service_id)
        print(f"deleted service pr-{pr_number}")
    deleted = delete_image_tags(
        image=preview_image(), pr_number=pr_number, keep_latest=keep_latest_image
    )
    print(f"deleted {deleted} image versions")
    return "The preview for this PR has been torn down." + (
        " Its latest image stays built; re-add the label to redeploy it."
        if keep_latest_image
        else ""
    )


def settle_with_pr_state(*, pr_number: int, service_id: str) -> None:
    """Tear the preview down if the PR closed or lost its label while this run was deploying.

    The teardown job cannot be relied on for that: a run queued behind a long deploy is
    dropped when a newer event queues, so the deploy checks for itself before it ends.
    """
    pr = json.loads(run_gh("pr", "view", str(pr_number), "--json", "state,labels"))
    labeled = PREVIEW_LABEL in {label["name"] for label in pr["labels"]}
    if pr["state"] == "OPEN" and labeled:
        return
    print(f"the PR is {pr['state'].lower()} and {'' if labeled else 'un'}labeled; tearing down")
    try:
        body = tear_down(
            pr_number=pr_number, service_id=service_id, keep_latest_image=pr["state"] == "OPEN"
        )
    except RailwayError as failure:
        # Say so rather than leave the deploy's comment advertising the instance.
        log_error(f"Railway API: {failure}")
        body = (
            "The PR is no longer labeled for a preview, but deleting its Railway service"
            " failed; see the workflow run."
        )
    upsert_comment(pr_number=pr_number, body=body)


def settle_quietly(*, pr_number: int, service_id: str) -> None:
    """settle_with_pr_state, where a GitHub hiccup must not fail a deploy that succeeded."""
    try:
        settle_with_pr_state(pr_number=pr_number, service_id=service_id)
    except subprocess.CalledProcessError as failure:
        warn(f"Could not check the PR's state after deploying: {failure.stderr}")


def run_note(args: argparse.Namespace) -> int:
    """Leave word on the PR that the run died before deploy.py could report.

    For a build failure, a cancellation or a timeout; deploy.py's own failures already
    leave their own comment.
    """
    upsert_comment(
        pr_number=args.pr,
        body=(
            f"### Preview of {args.head_sha[:7]}\n\nThe run failed, was cancelled or timed out"
            f" before it could report; see the [run]({args.run_url}). Whatever answers at the"
            " preview URL may be an earlier head. Re-add the label to try again."
        ),
    )
    return 0


def run_teardown(args: argparse.Namespace) -> int:
    """Delete the service, then the PR's image tags and the comment whatever Railway did."""
    try:
        project_id, _ = read_token_scope()
        service_id = find_service(project_id=project_id, name=f"pr-{args.pr}")
        body = tear_down(
            pr_number=args.pr, service_id=service_id, keep_latest_image=args.keep_latest_image
        )
        failed = False
    except RailwayError as failure:
        log_error(f"Railway API: {failure}")
        # The tags can still go; the service's fate is unknown and the comment says so.
        delete_image_tags(
            image=preview_image(), pr_number=args.pr, keep_latest=args.keep_latest_image
        )
        body = "Deleting the preview's Railway service failed; see the workflow run."
        failed = True
    upsert_comment(pr_number=args.pr, body=body, create=False)
    return 1 if failed else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    deploy_parser = subparsers.add_parser("deploy")
    deploy_parser.add_argument("--pr", type=int, required=True)
    deploy_parser.add_argument("--image-tag", required=True, help="tag on the preview image")
    deploy_parser.add_argument("--head-sha", required=True)
    deploy_parser.add_argument(
        "--seed", required=True, help="one line on the seed, for the comment"
    )
    deploy_parser.add_argument("--run-url", required=True)
    deploy_parser.set_defaults(run=run_deploy)
    note_parser = subparsers.add_parser("note")
    note_parser.add_argument("--pr", type=int, required=True)
    note_parser.add_argument("--head-sha", required=True)
    note_parser.add_argument("--run-url", required=True)
    note_parser.set_defaults(run=run_note)
    teardown_parser = subparsers.add_parser("teardown")
    teardown_parser.add_argument("--pr", type=int, required=True)
    teardown_parser.add_argument("--keep-latest-image", action="store_true")
    teardown_parser.set_defaults(run=run_teardown)
    args = parser.parse_args()
    try:
        return int(args.run(args))
    except RailwayError as failure:
        log_error(f"Railway API: {failure}")
        return 1
    except subprocess.CalledProcessError as failure:
        log_error(f"{' '.join(failure.cmd[:2])} failed: {failure.stderr}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
