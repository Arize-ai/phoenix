"""Decision evaluator definitions, deterministic scoring, and version compatibility."""

from datetime import datetime
from typing import Any, Optional, Sequence

from phoenix.db import models
from phoenix.db.types.annotation_configs import OutputConfigType
from phoenix.db.types.decision_evaluators import (
    ChoiceProjection,
    DecisionProjectionPolicy,
    PredicateProjection,
    ScaleProjection,
    derive_decision_output_configs,
    resolve_projection_policy,
)
from phoenix.db.types.decisions import DecisionInput, ScaleQuestion
from phoenix.db.types.evaluator_definition import EvaluatorSource, InlineDecisionEvaluatorDefinition
from phoenix.server.api.helpers.decision_clients import (
    ChoiceAnswer,
    DecisionResponse,
    PredicateAnswer,
    RefusalAnswer,
    ScaleAnswer,
)
from phoenix.server.api.helpers.evaluators import result_annotation_names


def decision_input_schema(inputs: Sequence[DecisionInput]) -> dict[str, Any]:
    """Describe inputs for mapping without enforcing their descriptive JSON schemas."""
    return {
        "type": "object",
        "properties": {input.name: input.json_schema or {} for input in inputs},
        "required": [input.name for input in inputs],
        "additionalProperties": False,
    }


def freeze_decision_evaluator(
    evaluator: models.DecisionEvaluator,
    *,
    policy_override: Optional[dict[str, Any]] = None,
    name: Optional[str] = None,
    description: Optional[str] = None,
    dataset_evaluator_id: Optional[int] = None,
) -> InlineDecisionEvaluatorDefinition:
    version = evaluator.selected_version
    if version is None:
        raise ValueError("The evaluator's pinned decision version was not found")
    policy = resolve_projection_policy(
        version.questions,
        DecisionProjectionPolicy.model_validate(
            policy_override if policy_override is not None else evaluator.projection_policy
        ),
    )
    return InlineDecisionEvaluatorDefinition(
        type="inline_decision_evaluator",
        schema_version=1,
        decision_schema_version=version.schema_version,
        name=name if name is not None else evaluator.name.root,
        description=description if description is not None else evaluator.description,
        inputs=version.inputs,
        state=version.state,
        questions=version.questions,
        model_provider=version.model_provider,
        model_name=version.model_name,
        custom_provider_id=version.custom_provider_id,
        projection_policy=policy,
        source=EvaluatorSource(
            evaluator_id=evaluator.id,
            decision_id=version.decision_id,
            decision_version_id=version.id,
            dataset_evaluator_id=dataset_evaluator_id,
        ),
    )


def validate_decision_output_overrides(
    definition: InlineDecisionEvaluatorDefinition, configs: Optional[Sequence[OutputConfigType]]
) -> list[OutputConfigType]:
    """Require explicit output overrides to preserve the question-derived scoring contract."""
    derived = derive_decision_output_configs(definition.questions, definition.projection_policy)
    if configs is not None and list(configs) != derived:
        raise ValueError(
            "Decision outputs are derived from the questions and projection policy; "
            "edit the projection policy to change scoring"
        )
    return derived


def project_decision_response(
    definition: InlineDecisionEvaluatorDefinition,
    response: DecisionResponse,
    *,
    name: str,
    trace_id: Optional[str],
    start_time: datetime,
    end_time: datetime,
) -> list[dict[str, Any]]:
    policy = resolve_projection_policy(definition.questions, definition.projection_policy)
    configs = derive_decision_output_configs(definition.questions, policy)
    names = result_annotation_names(name, configs)
    results = []
    for question, annotation_name in zip(definition.questions, names):
        answer = response.answers[question.name]
        projection = policy.questions[question.name]
        refused = isinstance(answer, RefusalAnswer)
        label = None
        score = None
        if isinstance(answer, PredicateAnswer):
            assert isinstance(projection, PredicateProjection)
            score = answer.probability
            label = "true" if score >= projection.threshold else "false"
        elif isinstance(answer, ChoiceAnswer):
            assert isinstance(projection, ChoiceProjection)
            label = answer.choice
            score = projection.scores.get(answer.choice)
        elif isinstance(answer, ScaleAnswer):
            assert isinstance(projection, ScaleProjection)
            assert isinstance(question, ScaleQuestion)
            score = answer.expected_level
            if projection.include_label:
                level = max(
                    range(len(question.levels)), key=lambda index: answer.probabilities[index]
                )
                label = question.levels[level].label
        results.append(
            {
                "name": annotation_name,
                "annotator_kind": "LLM",
                "label": label,
                "score": score,
                "explanation": "Decision model refused this question" if refused else None,
                "metadata": {
                    "decision": {
                        "schema_version": 1,
                        "status": "refused" if refused else "answered",
                        "question": {"name": question.name, "type": question.type},
                        "answer": answer.model_dump(mode="json"),
                        "projection": projection.model_dump(mode="json"),
                        "requested_model": definition.model_name,
                        "resolved_model": response.model,
                        "provider": definition.model_provider.value,
                        "source": definition.source.model_dump(mode="json")
                        if definition.source
                        else None,
                    }
                },
                "error": None,
                "trace_id": trace_id,
                "start_time": start_time,
                "end_time": end_time,
            }
        )
    return results
