import pytest
from pydantic import ValidationError

from metadata import TaskMetadata, validate_collection


def facets(**updates):
    return (
        dict(
            task_id="trace-count",
            task_version="1",
            task_family_id="trace-count",
            task_type="aggregation",
            primary_surface="tracing",
            product_surfaces=["tracing"],
            operation_types=["aggregate"],
            mutability="read_only",
            split="development",
            suites=["smoke", "core"],
            difficulty="easy",
            difficulty_rationale="One aggregate",
            challenge_tags=[],
            data_scale={"category": "tiny", "traces": 2, "spans": 2},
            fixture_corpus="original",
            fixture_revision="1",
            fixture_hash="a" * 64,
            required_capabilities=["trace_count"],
            eligible_interfaces=["mcp", "cli"],
            verification_types=["deterministic", "policy"],
            evaluator_ids=["trace-count@1"],
            rubric_version="1",
            sql_opportunity="aggregation",
        )
        | updates
    )


def test_observations_and_inconsistent_facets_rejected():
    for change in (
        {"uses_sql": True},
        {"primary_surface": "datasets"},
        {"operation_types": ["create"]},
        {"fixture_hash": "latest"},
    ):
        with pytest.raises(ValidationError):
            TaskMetadata(**facets(**change))


def test_split_is_by_family_and_ids_are_unique():
    task = TaskMetadata(**facets())
    with pytest.raises(ValueError, match="Duplicate"):
        validate_collection([task, task])
    variant = TaskMetadata(**facets(task_id="trace-count-variant", split="holdout"))
    with pytest.raises(ValueError, match="Family crosses"):
        validate_collection([task, variant])
