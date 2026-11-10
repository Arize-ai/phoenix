"""Validate evaluator output configurations and decision input mappings."""

from typing import Optional, Sequence

from pydantic import BaseModel, Field, field_validator

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    CategoricalOutputConfig,
    OutputConfigType,
)
from phoenix.db.types.evaluators import InputMapping
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.decisions.rendering import decision_variables


class LLMEvaluatorOutputConfigs(BaseModel):
    """Validated output configs for LLM evaluators (categorical only)."""

    configs: list[CategoricalOutputConfig] = Field(min_length=1)

    @field_validator("configs")
    @classmethod
    def check_unique_names(
        cls, configs: list[CategoricalOutputConfig]
    ) -> list[CategoricalOutputConfig]:
        names = [c.name for c in configs]
        if len(names) != len(set(names)):
            duplicates = [n for n in names if names.count(n) > 1]
            raise ValueError(f"Config names must be unique. Duplicates found: {set(duplicates)}")
        return configs


def require_categorical_output_configs(configs: Sequence[OutputConfigType]) -> None:
    """LLM evaluators answer through a label-choosing tool, so every output must be categorical."""
    if any(not isinstance(config, CategoricalOutputConfig) for config in configs):
        raise ValueError(
            "LLM evaluators only support categorical output configs. Non-categorical config found."
        )


# The keys of the context a dataset evaluator judges a run with (see experiment_runner).
EVALUATOR_CONTEXT_KEYS = ("input", "output", "reference", "metadata")
# What online evaluation fills from a span, trace, or session; there is no reference.
PROJECT_EVALUATOR_CONTEXT_KEYS = ("input", "output", "metadata")


def validate_decision_input_mapping(
    version: models.DecisionVersion,
    input_mapping: Optional[InputMapping],
    *,
    context_keys: Sequence[str] = EVALUATOR_CONTEXT_KEYS,
    context: str = "experiment run",
) -> None:
    """Reject a mapping that names variables the decision doesn't use, or leaves one of its
    variables unfillable.

    Keys the decision doesn't use would otherwise be silently dropped at run time. An
    unmapped variable is filled from the context only when it is named like one of the
    context's keys; any other would fail every run as missing.
    """
    declared = decision_variables(version.template_format, version.state, version.questions)
    mapped = (
        set(input_mapping.path_mapping) | set(input_mapping.literal_mapping)
        if input_mapping is not None
        else set()
    )
    if unknown := sorted(mapped - set(declared)):
        raise BadRequest(
            f"Input mapping names variables the decision doesn't use: "
            f"{', '.join(repr(k) for k in unknown)}. "
            f"Its variables: {', '.join(repr(n) for n in declared) or 'none'}"
        )
    if unfilled := [name for name in declared if name not in mapped and name not in context_keys]:
        raise BadRequest(
            f"Map the variables {', '.join(repr(name) for name in unfilled)}: only variables named "
            f"{', '.join(repr(key) for key in context_keys)} are filled from the "
            f"{context} without a mapping"
        )
