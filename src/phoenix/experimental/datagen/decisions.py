"""Seed saved native decisions for Typed Decisions workflows idempotently."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Mapping, Sequence

import httpx

from phoenix.experimental.datagen.datasets import DatasetError

if TYPE_CHECKING:
    from phoenix.client.resources.datasets import Dataset

TYPED_DECISIONS_DATASET_NAME = "px-datagen-typed-decisions"
_WORKFLOWS = {
    "agent_trace_observability",
    "customer_service",
    "invoice_processing",
    "security_incidents",
}


@dataclass(frozen=True)
class WorkflowDefinition:
    workflow: str
    questions: Mapping[str, Any]
    source_metadata: Mapping[str, Any]

    @property
    def name(self) -> str:
        return f"{TYPED_DECISIONS_DATASET_NAME}-{self.workflow}"


def load_workflow_definitions(datasets: Sequence[Dataset]) -> list[WorkflowDefinition]:
    """Validate every workflow before writing any definitions."""
    definitions = []
    for dataset in datasets:
        if dataset.name != TYPED_DECISIONS_DATASET_NAME:
            continue
        examples = dataset.examples
        if not examples:
            raise DatasetError(f"{dataset.name}: cannot build a definition from an empty dataset")
        groups: dict[str, list[Any]] = {}
        for example in examples:
            workflow = example["metadata"].get("workflow")
            if not isinstance(workflow, str) or workflow not in _WORKFLOWS:
                raise DatasetError(f"{dataset.name}: invalid workflow metadata {workflow!r}")
            groups.setdefault(workflow, []).append(example)
        for workflow, group in sorted(groups.items()):
            questions = group[0]["input"]["questions"]
            if any(example["input"]["questions"] != questions for example in group):
                raise DatasetError(f"{workflow}: examples must share the same questions")
            definitions.append(WorkflowDefinition(workflow, questions, group[0]["metadata"]))
    return definitions


_VERSION_FIELDS = """
  id description metadata modelProvider modelName customProvider { id }
  inputs { name description jsonSchema }
  state { __typename ... on DecisionInputState { input } ... on DecisionObjectState { object } }
  questions {
    __typename
    ... on DecisionPredicateQuestion { name instructions criteria { true false } }
    ... on DecisionChoiceQuestion { name instructions choices { value description } }
    ... on DecisionScaleQuestion { name instructions levels { label description } }
  }
"""
_FIND = f"""
query DatagenWorkflowDecisions($name: String!, $after: String) {{
  decisions(first: 100, after: $after, filter: {{col: name, value: $name}}) {{
    edges {{ node {{ id name version {{ {_VERSION_FIELDS} }} }} }}
    pageInfo {{ hasNextPage endCursor }}
  }}
}}
"""
_CREATE = """
mutation DatagenCreateDecision($input: CreateDecisionInput!) {
  createDecision(input: $input) { version { id } }
}
"""
_CREATE_VERSION = """
mutation DatagenCreateDecisionVersion($input: CreateDecisionVersionInput!) {
  createDecisionVersion(input: $input) { version { id } }
}
"""


def build_workflow_decision(
    workflow: str,
    questions: Mapping[str, Any],
    *,
    source_metadata: Mapping[str, Any],
) -> dict[str, Any]:
    """Build the five native questions, preserving criterion order and rubric values."""
    if len(questions) != 5:
        raise DatasetError(f"{workflow}: expected five workflow questions")
    native_questions = []
    for name, question in questions.items():
        common = {"name": name, "instructions": question["instructions"]}
        criteria = question.get("criteria", {})
        kind = question["type"]
        if kind == "noul":
            native_questions.append(
                {
                    "predicate": {
                        **common,
                        "criteria": {"true": criteria.get("true"), "false": criteria.get("false")},
                    }
                }
            )
        elif kind == "choice":
            native_questions.append(
                {
                    "choice": {
                        **common,
                        "choices": [
                            {"value": value, "description": description}
                            for value, description in criteria.items()
                        ],
                    }
                }
            )
        elif kind == "score":
            native_questions.append(
                {
                    "scale": {
                        **common,
                        "levels": [
                            {"label": str(index), "description": description}
                            for index, description in enumerate(criteria)
                        ],
                    }
                }
            )
        else:
            raise DatasetError(f"{workflow}: unsupported question type {kind!r}")
    metadata = {
        "workflow": workflow,
        "dataset_name": TYPED_DECISIONS_DATASET_NAME,
        **{key: value for key, value in source_metadata.items() if key.startswith("source_")},
    }
    return {
        "inputs": [
            {"name": "state", "description": "The workflow state to evaluate.", "jsonSchema": None}
        ],
        "state": {"input": "state"},
        "questions": native_questions,
        "modelProvider": "TYPESAFE",
        "modelName": "jev-latest",
        "customProviderId": None,
        "description": "Datagen-owned TypeSafe decision for Typed Decisions.",
        "metadata": metadata,
    }


def _graphql(http: httpx.Client, query: str, variables: Mapping[str, Any]) -> dict[str, Any]:
    response = http.post("graphql", json={"query": query, "variables": variables})
    response.raise_for_status()
    result = response.json()
    if result.get("errors"):
        raise DatasetError(
            "Decision seeding failed: " + "; ".join(error["message"] for error in result["errors"])
        )
    data: dict[str, Any] = result["data"]
    return data


def _find_decision(http: httpx.Client, name: str) -> dict[str, Any] | None:
    after = None
    while True:
        connection = _graphql(http, _FIND, {"name": name, "after": after})["decisions"]
        for edge in connection["edges"]:
            decision: dict[str, Any] = edge["node"]
            if decision["name"] == name:
                return decision
        if not connection["pageInfo"]["hasNextPage"]:
            return None
        after = connection["pageInfo"]["endCursor"]


def _same_decision(saved: Mapping[str, Any] | None, desired: Mapping[str, Any]) -> bool:
    if saved is None:
        return False
    if saved["state"]["__typename"] == "DecisionInputState":
        state = {"input": saved["state"]["input"]}
    elif saved["state"]["__typename"] == "DecisionObjectState":
        state = {"object": saved["state"]["object"]}
    else:
        return False
    variants = {
        "DecisionPredicateQuestion": "predicate",
        "DecisionChoiceQuestion": "choice",
        "DecisionScaleQuestion": "scale",
    }
    questions = []
    for question in saved["questions"]:
        variant = variants.get(question["__typename"])
        if variant is None:
            return False
        questions.append(
            {variant: {key: value for key, value in question.items() if key != "__typename"}}
        )
    content = {
        "inputs": saved["inputs"],
        "state": state,
        "questions": questions,
        "modelProvider": saved["modelProvider"],
        "modelName": saved["modelName"],
        "customProviderId": saved["customProvider"]["id"] if saved["customProvider"] else None,
        "description": saved["description"],
        "metadata": saved["metadata"],
    }
    return content == desired


def seed_workflow_decisions(
    http: httpx.Client, datasets: Sequence[Dataset]
) -> list[tuple[str, str]]:
    """Seed one decision per workflow; add a version only when its definition changes.

    Uses the authenticated server GraphQL API because the client has no decision resource.
    All definitions are built before writing. Seeding never invokes a model.
    """
    definitions = [
        (
            definition.name,
            build_workflow_decision(
                definition.workflow,
                definition.questions,
                source_metadata=definition.source_metadata,
            ),
        )
        for definition in load_workflow_definitions(datasets)
    ]
    return [
        (
            name,
            seed_decision(
                http,
                name=name,
                version=desired,
                metadata={
                    "workflow": desired["metadata"]["workflow"],
                    "datagen": True,
                },
            ),
        )
        for name, desired in definitions
    ]


def seed_decision(
    http: httpx.Client, *, name: str, version: dict[str, Any], metadata: Mapping[str, Any]
) -> str:
    """Save a datagen-owned decision, adding a version only when its content changes."""
    decision = _find_decision(http, name)
    if decision is None:
        saved = _graphql(
            http,
            _CREATE,
            {
                "input": {
                    "name": name,
                    "description": version["description"],
                    "metadata": metadata,
                    "version": version,
                }
            },
        )["createDecision"]
    elif _same_decision(decision["version"], version):
        saved = decision
    else:
        saved = _graphql(
            http,
            _CREATE_VERSION,
            {"input": {"decisionId": decision["id"], "version": version}},
        )["createDecisionVersion"]
    return str(saved["version"]["id"])
