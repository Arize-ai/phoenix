"""
Test: What happens to evaluator projects when a dataset is deleted?

This script:
1. Creates a dataset
2. Creates a builtin evaluator for the dataset (which creates a linked project)
3. Verifies the evaluator project is hidden from the `projects` resolver
4. Deletes the dataset via the REST API
5. Checks whether the evaluator project is now orphaned and visible in `projects`

Expected behavior (per the code analysis):
- Before deletion: evaluator project is HIDDEN from `projects` resolver (correctly filtered)
- After deletion: evaluator project LEAKS into the `projects` resolver (the bug)

Run with Phoenix already started, e.g.:
    PHOENIX_SQL_DATABASE_URL=sqlite:///:memory: uv run python -m phoenix.server.main serve
    uv run python scripts/test_delete_dataset_evaluator_projects.py

Phoenix port comes from app/.env (PHOENIX_PORT=6149).

"""

import json
import time
import uuid
from typing import Any, Dict, List, Optional

import requests

PHOENIX_URL = "http://localhost:6149"
GQL_URL = f"{PHOENIX_URL}/graphql"

# ── helpers ──────────────────────────────────────────────────────────────────


def gql(query: str, variables: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    resp = requests.post(
        GQL_URL,
        json={"query": query, "variables": variables or {}},
        timeout=10,
    )
    resp.raise_for_status()
    data: Dict[str, Any] = resp.json()
    if "errors" in data:
        raise RuntimeError(f"GraphQL errors: {json.dumps(data['errors'], indent=2)}")
    result: Dict[str, Any] = data["data"]
    return result


def get_all_projects(include_evaluator_projects: bool = False) -> List[Dict[str, Any]]:
    """Query projects via REST (supports include_dataset_evaluator_projects flag)."""
    params: Dict[str, str] = {}
    if include_evaluator_projects:
        params["include_dataset_evaluator_projects"] = "true"
    resp = requests.get(f"{PHOENIX_URL}/v1/projects", params=params, timeout=10)
    resp.raise_for_status()
    result: List[Dict[str, Any]] = resp.json()["data"]
    return result


def get_projects_via_graphql() -> List[Dict[str, Any]]:
    """Query the projects GraphQL resolver (uses same filters as UI)."""
    data = gql("""
        query {
            projects {
                edges {
                    node {
                        id
                        name
                    }
                }
            }
        }
    """)
    result: List[Dict[str, Any]] = [edge["node"] for edge in data["projects"]["edges"]]
    return result


# ── test steps ───────────────────────────────────────────────────────────────


def step_create_dataset() -> str:
    """Create a dataset and return its GlobalID."""
    print("Step 1: Creating dataset …")
    resp = requests.post(
        f"{PHOENIX_URL}/v1/datasets/upload",
        params={"sync": "true"},
        json={
            "name": f"test-evaluator-leak-{uuid.uuid4().hex[:8]}",
            "description": "Dataset for testing evaluator project cleanup",
            "inputs": [{"question": "What is 2+2?"}],
            "outputs": [{"answer": "4"}],
        },
        timeout=10,
    )
    resp.raise_for_status()
    dataset_id: str = resp.json()["data"]["dataset_id"]
    print(f"  Created dataset: id={dataset_id}")
    return dataset_id


def step_get_builtin_evaluator_id() -> str:
    """Return the GlobalID of the first available builtin evaluator."""
    print("Step 2: Fetching builtin evaluators …")
    data = gql("""
        query {
            builtInEvaluators {
                id
                name
            }
        }
    """)
    evaluators: List[Dict[str, Any]] = data["builtInEvaluators"]
    if not evaluators:
        raise RuntimeError("No builtin evaluators found — cannot proceed with test")
    evaluator = evaluators[0]
    print(f"  Using builtin evaluator: id={evaluator['id']}, name={evaluator['name']}")
    result: str = evaluator["id"]
    return result


def step_create_dataset_evaluator(dataset_id: str, builtin_evaluator_id: str) -> None:
    """Create a builtin dataset evaluator (prints the linked project info)."""
    print("Step 3: Creating dataset evaluator (creates a linked project) …")
    data = gql(
        """
        mutation CreateDatasetEvaluator($input: CreateDatasetBuiltinEvaluatorInput!) {
            createDatasetBuiltinEvaluator(input: $input) {
                evaluator {
                    id
                    name
                    project {
                        id
                        name
                    }
                }
            }
        }
        """,
        variables={
            "input": {
                "datasetId": dataset_id,
                "evaluatorId": builtin_evaluator_id,
                "name": "test-builtin-eval",
            }
        },
    )
    evaluator: Dict[str, Any] = data["createDatasetBuiltinEvaluator"]["evaluator"]
    print(f"  Created DatasetEvaluator: id={evaluator['id']}, name={evaluator['name']}")
    if evaluator.get("project"):
        print(
            f"  Linked project: id={evaluator['project']['id']}, "
            f"name={evaluator['project']['name']}"
        )


def step_check_projects(label: str) -> None:
    """Report current project visibility via both REST and GraphQL."""
    print(f"\n--- Projects visible [{label}] ---")

    gql_projects = get_projects_via_graphql()
    print(f"  GraphQL `projects` resolver: {len(gql_projects)} project(s)")
    for p in gql_projects:
        print(f"    - {p['name']} (id={p['id']})")

    rest_projects_normal = get_all_projects(include_evaluator_projects=False)
    print(f"  REST /v1/projects (no flag): {len(rest_projects_normal)} project(s)")
    for p in rest_projects_normal:
        print(f"    - {p['name']} (id={p['id']})")

    rest_projects_all = get_all_projects(include_evaluator_projects=True)
    print(
        f"  REST /v1/projects?include_dataset_evaluator_projects=true: "
        f"{len(rest_projects_all)} project(s)"
    )
    for p in rest_projects_all:
        print(f"    - {p['name']} (id={p['id']})")
    print()


def step_delete_dataset(dataset_id: str) -> None:
    """Delete the dataset via the REST API."""
    print(f"Step 4: Deleting dataset (id={dataset_id}) …")
    resp = requests.delete(f"{PHOENIX_URL}/v1/datasets/{dataset_id}", timeout=10)
    if resp.status_code == 204:
        print("  Dataset deleted successfully (HTTP 204).")
    else:
        print(f"  Unexpected response: {resp.status_code} {resp.text}")
        resp.raise_for_status()


# ── main ─────────────────────────────────────────────────────────────────────


def main() -> None:
    # 1. Create dataset
    dataset_id = step_create_dataset()

    # 2. Get a builtin evaluator to attach
    builtin_evaluator_id = step_get_builtin_evaluator_id()

    # 3. Create a dataset evaluator (this creates a hidden project)
    step_create_dataset_evaluator(dataset_id, builtin_evaluator_id)

    # 4. Check project visibility BEFORE deletion
    step_check_projects("BEFORE dataset deletion")

    # 5. Delete the dataset
    step_delete_dataset(dataset_id)

    # Small delay for background tasks to run
    time.sleep(1)

    # 6. Check project visibility AFTER deletion
    step_check_projects("AFTER dataset deletion")

    # 7. Summary
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    gql_after = get_projects_via_graphql()
    rest_after = get_all_projects(include_evaluator_projects=False)
    evaluator_project_name_prefix = "dataset-evaluator-"

    leaked_gql = [p for p in gql_after if p["name"].startswith(evaluator_project_name_prefix)]
    leaked_rest = [p for p in rest_after if p["name"].startswith(evaluator_project_name_prefix)]

    if leaked_gql or leaked_rest:
        print("BUG CONFIRMED: Evaluator project(s) leaked after dataset deletion:")
        for p in leaked_gql:
            print(f"  [GraphQL] {p['name']}")
        for p in leaked_rest:
            print(f"  [REST]    {p['name']}")
        print()
        print("Root cause: delete_dataset only cleans up Experiment.project_name-based")
        print("projects, not DatasetEvaluators.project_id-based projects. After the")
        print("dataset is deleted (cascade-deleting DatasetEvaluators rows), the")
        print("exclude_dataset_evaluator_projects filter no longer matches the orphaned")
        print("project, so it becomes visible in the `projects` resolver.")
    else:
        print("No evaluator projects leaked. Either the bug is fixed, or the test")
        print("didn't exercise the right code path.")


if __name__ == "__main__":
    main()
