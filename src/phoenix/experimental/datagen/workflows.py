"""Workflow definitions for Typed Decisions decision seeds."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Mapping, Sequence

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
            if len(questions) != 5:
                raise DatasetError(f"{workflow}: expected five workflow questions")
            if any(example["input"]["questions"] != questions for example in group):
                raise DatasetError(f"{workflow}: examples must share the same questions")
            definitions.append(WorkflowDefinition(workflow, questions, group[0]["metadata"]))
    return definitions
