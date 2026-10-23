"""Decision evaluator definitions, deterministic scoring, and version compatibility."""

from datetime import datetime
from typing import Annotated, Any, Literal, Optional, Sequence, Union

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from phoenix.db import models
from phoenix.db.types.decision_evaluators import (
    ChoiceScoring,
    DecisionQuestionScoring,
    DecisionScoringPolicy,
    PredicateScoring,
    ScaleScoring,
    derive_decision_output_configs,
    resolve_scoring_policy,
)
from phoenix.db.types.decisions import (
    ChoiceOption,
    ChoiceQuestion,
    DecisionInput,
    DecisionQuestion,
    ScaleLevel,
    ScaleQuestion,
)
from phoenix.db.types.evaluator_definition import EvaluatorSource, InlineDecisionEvaluatorDefinition
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.helpers.decision_clients import (
    ChoiceAnswer,
    DecisionAnswer,
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


def capture_decision_evaluator_definition(
    evaluator: models.DecisionEvaluator,
    *,
    name: Optional[str] = None,
    description: Optional[str] = None,
    dataset_evaluator_id: Optional[int] = None,
    project_evaluator_id: Optional[int] = None,
) -> InlineDecisionEvaluatorDefinition:
    version = evaluator.selected_version
    if version is None:
        raise ValueError("The evaluator's pinned decision version was not found")
    policy = resolve_scoring_policy(version.questions, evaluator.scoring_policy)
    return InlineDecisionEvaluatorDefinition(
        type="inline_decision_evaluator",
        name=name if name is not None else evaluator.name.root,
        description=description if description is not None else evaluator.description,
        inputs=version.inputs,
        state=version.state,
        questions=version.questions,
        model_provider=version.model_provider,
        model_name=version.model_name,
        custom_provider_id=version.custom_provider_id,
        scoring_policy=policy,
        source=EvaluatorSource(
            evaluator_id=evaluator.id,
            decision_version_id=version.id,
            dataset_evaluator_id=dataset_evaluator_id,
            project_evaluator_id=project_evaluator_id,
        ),
    )


class _AnnotationModel(BaseModel):
    # Fields added later are optional, so payloads written before them still validate.
    model_config = ConfigDict(frozen=True)


class DecisionAnnotationQuestion(_AnnotationModel):
    """The asked question's identity, with a choice's options or a scale's levels, since
    answers and scoring settings refer to them by value or position only."""

    name: str
    type: Literal["predicate", "choice", "scale"]
    choices: Optional[list[ChoiceOption]] = None
    levels: Optional[list[ScaleLevel]] = None

    @classmethod
    def from_question(cls, question: DecisionQuestion) -> "DecisionAnnotationQuestion":
        return cls(
            name=question.name,
            type=question.type,
            choices=list(question.choices) if isinstance(question, ChoiceQuestion) else None,
            levels=list(question.levels) if isinstance(question, ScaleQuestion) else None,
        )


class AnsweredDecisionAnnotation(_AnnotationModel):
    """``metadata.decision`` on a judge's annotation for a question it answered or refused."""

    status: Literal["answered", "refused"]
    question: DecisionAnnotationQuestion
    answer: DecisionAnswer
    scoring: DecisionQuestionScoring
    requested_model: str
    resolved_model: Optional[str] = None
    provider: ModelProvider
    custom_provider_id: Optional[int] = None
    source: Optional[EvaluatorSource] = None


class ErroredDecisionAnnotation(_AnnotationModel):
    """``metadata.decision`` on a judge's annotation when the call failed; the message is
    the annotation's ``error``."""

    status: Literal["error"]
    source: Optional[EvaluatorSource] = None


DecisionAnnotation = Annotated[
    Union[AnsweredDecisionAnnotation, ErroredDecisionAnnotation],
    Field(discriminator="status"),
]


class _DecisionAnnotationMetadata(BaseModel):
    decision: DecisionAnnotation


def decision_annotation_metadata(decision: DecisionAnnotation) -> dict[str, Any]:
    """An annotation's metadata for a judge's result."""
    return {"decision": decision.model_dump(mode="json")}


def parse_decision_annotation(metadata: Any) -> Optional[DecisionAnnotation]:
    """The decision payload in an annotation's metadata, or None when it has none or it
    doesn't match the format. Metadata is ordinary JSON any client can write, so a match
    means the format, not which evaluator wrote it."""
    if not isinstance(metadata, dict) or "decision" not in metadata:
        return None
    try:
        return _DecisionAnnotationMetadata.model_validate(metadata).decision
    except ValidationError:
        return None


def project_decision_response(
    definition: InlineDecisionEvaluatorDefinition,
    response: DecisionResponse,
    *,
    name: str,
    trace_id: Optional[str],
    start_time: datetime,
    end_time: datetime,
    annotation_names: Optional[Sequence[str]] = None,
    scoring_policy: Optional[DecisionScoringPolicy] = None,
) -> list[dict[str, Any]]:
    policy = scoring_policy or resolve_scoring_policy(
        definition.questions, definition.scoring_policy
    )
    names = annotation_names or result_annotation_names(
        name, derive_decision_output_configs(definition.questions, policy)
    )
    results = []
    for question, annotation_name in zip(definition.questions, names):
        answer = response.answers[question.name]
        scoring = policy.questions[question.name]
        refused = isinstance(answer, RefusalAnswer)
        label = None
        score = None
        if isinstance(answer, PredicateAnswer):
            assert isinstance(scoring, PredicateScoring)
            score = answer.probability
            label = "true" if score >= scoring.threshold else "false"
        elif isinstance(answer, ChoiceAnswer):
            assert isinstance(scoring, ChoiceScoring)
            label = answer.choice
            score = scoring.scores.get(answer.choice)
        elif isinstance(answer, ScaleAnswer):
            assert isinstance(scoring, ScaleScoring)
            assert isinstance(question, ScaleQuestion)
            score = answer.expected_level
            if scoring.include_label:
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
                "explanation": "Decision model refused this question." if refused else None,
                "metadata": decision_annotation_metadata(
                    AnsweredDecisionAnnotation(
                        status="refused" if refused else "answered",
                        question=DecisionAnnotationQuestion.from_question(question),
                        answer=answer,
                        scoring=scoring,
                        requested_model=definition.model_name,
                        resolved_model=response.model,
                        provider=definition.model_provider,
                        custom_provider_id=definition.custom_provider_id,
                        source=definition.source,
                    )
                ),
                "error": None,
                "trace_id": trace_id,
                "start_time": start_time,
                "end_time": end_time,
            }
        )
    return results
