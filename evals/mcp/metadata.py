"""Authored facets only. Run observations never enter dataset task metadata."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Surface = Literal["tracing", "annotations", "datasets", "experiments", "prompts", "sessions"]


class DataScale(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    category: Literal["tiny", "pagination", "large"]
    traces: int = Field(ge=0)
    spans: int = Field(ge=0)


class TaskMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    metadata_schema_version: Literal["1"] = "1"
    task_id: str = Field(pattern=r"^[a-z0-9][a-z0-9-]+$")
    task_version: str = Field(min_length=1)
    task_family_id: str = Field(min_length=1)
    task_type: Literal[
        "lookup", "aggregation", "comparison", "diagnosis", "creation", "update", "batch_mutation"
    ]
    primary_surface: Surface
    product_surfaces: list[Surface] = Field(min_length=1)
    operation_types: list[
        Literal["list", "filter", "aggregate", "join", "drilldown", "create", "update", "delete"]
    ] = Field(min_length=1)
    mutability: Literal["read_only", "writes"]
    split: Literal["development", "holdout"]
    suites: list[Literal["smoke", "core", "extended", "calibration"]] = Field(min_length=1)
    difficulty: Literal["easy", "medium", "hard"]
    difficulty_rationale: str = Field(min_length=1)
    challenge_tags: list[
        Literal[
            "pagination",
            "cross_resource",
            "multi_requirement",
            "empty_result",
            "version_selection",
            "error_recovery",
            "precise_mutation_scope",
        ]
    ]
    data_scale: DataScale
    fixture_corpus: str = Field(min_length=1)
    fixture_revision: str = Field(min_length=1)
    fixture_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    required_capabilities: list[str] = Field(min_length=1)
    eligible_interfaces: list[Literal["mcp", "cli"]] = Field(min_length=1)
    verification_types: list[Literal["deterministic", "state", "policy", "llm"]]
    evaluator_ids: list[str] = Field(min_length=1)
    rubric_version: str = Field(min_length=1)
    sql_opportunity: Literal["aggregation", "join", "none"]

    @model_validator(mode="after")
    def consistent_facets(self) -> TaskMetadata:
        if self.primary_surface not in self.product_surfaces:
            raise ValueError("primary_surface must belong to product_surfaces")
        writes = {"create", "update", "delete"}.intersection(self.operation_types)
        if self.mutability == "read_only" and writes:
            raise ValueError("read_only task declares write operations")
        return self


def validate_collection(tasks: list[TaskMetadata]) -> None:
    ids: set[str] = set()
    families: dict[str, str] = {}
    for task in tasks:
        if task.task_id in ids:
            raise ValueError(f"Duplicate task ID: {task.task_id}")
        ids.add(task.task_id)
        if families.setdefault(task.task_family_id, task.split) != task.split:
            raise ValueError(f"Family crosses development/holdout: {task.task_family_id}")
