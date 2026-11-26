"""Shared Railway project ownership and PR state for Factory Preview."""

import json
import os
import re
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Optional
from uuid import UUID

from gh import run_gh
from settings import PreviewSettings, parse_settings

RAILWAY_API_URL = "https://backboard.railway.com/graphql/v2"
PREVIEW_LABEL = "factory-preview"
PREVIEW_PROJECT_PREFIX = "phoenix-preview-pr-"
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
