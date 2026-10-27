"""Native decision evaluator runtime, deterministic scoring projection, and annotation metadata."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Annotated, Any, Literal, Optional, Sequence, Union

import openinference.instrumentation as oi
from opentelemetry.context import Context
from opentelemetry.trace import NoOpTracer, Status, StatusCode, Tracer, format_trace_id
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from phoenix.db.types.annotation_configs import OutputConfigType
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
    DecisionQuestion,
    ScaleLevel,
    ScaleQuestion,
)
from phoenix.db.types.evaluator_definition import EvaluatorSource, InlineDecisionEvaluatorDefinition
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.helpers.decision_clients import (
    ChoiceAnswer,
    DecisionAnswer,
    DecisionClient,
    DecisionRequest,
    DecisionResponse,
    PredicateAnswer,
    RefusalAnswer,
    ScaleAnswer,
)
from phoenix.server.decisions.rendering import render_state
from phoenix.server.evaluators.input_mapping import apply_input_mapping
from phoenix.server.evaluators.runtime.base import (
    BaseEvaluator,
    EvaluationResult,
    EvaluatorAnnotatorKind,
    RenderedMessageTooLargeError,
    result_annotation_names,
)
from phoenix.server.evaluators.schemas import decision_input_schema


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
    def from_question(cls, question: DecisionQuestion) -> DecisionAnnotationQuestion:
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
) -> list[EvaluationResult]:
    policy = scoring_policy or resolve_scoring_policy(
        definition.questions, definition.scoring_policy
    )
    names = annotation_names or result_annotation_names(
        name, derive_decision_output_configs(definition.questions, policy)
    )
    results: list[EvaluationResult] = []
    for question, annotation_name in zip(definition.questions, names):
        answer = response.answers[question.name]
        scoring = policy.questions[question.name]
        refused = isinstance(answer, RefusalAnswer)
        label: Optional[str] = None
        score: Optional[float] = None
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
            EvaluationResult(
                name=annotation_name,
                annotator_kind="LLM",
                label=label,
                score=score,
                explanation="Decision model refused this question." if refused else None,
                metadata=decision_annotation_metadata(
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
                error=None,
                trace_id=trace_id,
                start_time=start_time,
                end_time=end_time,
            )
        )
    return results


class DecisionEvaluator(BaseEvaluator):
    def __init__(
        self,
        definition: InlineDecisionEvaluatorDefinition,
        client: DecisionClient,
        *,
        max_request_bytes: Optional[int] = None,
    ):
        self._scoring_policy = resolve_scoring_policy(
            definition.questions, definition.scoring_policy
        )
        self._output_configs = tuple(
            derive_decision_output_configs(definition.questions, self._scoring_policy)
        )
        self._input_schema = decision_input_schema(definition.inputs)
        self.definition = definition
        self.client = client
        # Online evaluation caps what one call sends, as it caps an LLM judge's messages.
        self.max_request_bytes = max_request_bytes

    @property
    def name(self) -> str:
        return self.definition.name

    @property
    def description(self) -> Optional[str]:
        return self.definition.description

    @property
    def input_schema(self) -> dict[str, Any]:
        return self._input_schema

    @property
    def output_configs(self) -> Sequence[OutputConfigType]:
        return self._output_configs

    @property
    def provider_client(self) -> DecisionClient:
        return self.client

    def _check_request_size(self, request: DecisionRequest) -> None:
        if self.max_request_bytes is None:
            return
        state = request.state if isinstance(request.state, str) else json.dumps(request.state)
        questions = json.dumps([question.model_dump(mode="json") for question in request.questions])
        size = len(state.encode("utf-8")) + len(questions.encode("utf-8"))
        if size > self.max_request_bytes:
            raise RenderedMessageTooLargeError(
                f"The rendered state and questions are {size} bytes, exceeding the "
                f"{self.max_request_bytes}-byte limit. Narrow the inputs with a path mapping, "
                "or raise the limit with PHOENIX_ONLINE_EVAL_MAX_LLM_MESSAGE_BYTES."
            )

    @property
    def error_metadata(self) -> dict[str, Any]:
        return decision_annotation_metadata(
            ErroredDecisionAnnotation(status="error", source=self.definition.source)
        )

    @property
    def annotator_kind(self) -> EvaluatorAnnotatorKind:
        return "LLM"

    async def evaluate(
        self,
        *,
        context: dict[str, Any],
        input_mapping: InputMapping,
        name: str,
        output_configs: Sequence[OutputConfigType],
        tracer: Optional[Tracer] = None,
    ) -> list[EvaluationResult]:
        annotation_names = result_annotation_names(name, output_configs)
        started = datetime.now(timezone.utc)
        collector = tracer or NoOpTracer()
        with collector.start_as_current_span(
            f"Evaluator: {name}",
            context=Context(),
            attributes={
                **oi.get_span_kind_attributes("evaluator"),
                **oi.get_input_attributes(context),
            },
        ) as span:
            trace_id = format_trace_id(span.get_span_context().trace_id) if tracer else None
            try:
                values = apply_input_mapping(
                    input_schema=self.input_schema, input_mapping=input_mapping, context=context
                )
                request = DecisionRequest(
                    state=render_state(self.definition.inputs, self.definition.state, values),
                    questions=self.definition.questions,
                )
                self._check_request_size(request)
                response = await self.client.create(request=request, tracer=collector)
                results = project_decision_response(
                    self.definition,
                    response,
                    name=name,
                    trace_id=trace_id,
                    start_time=started,
                    end_time=datetime.now(timezone.utc),
                    annotation_names=annotation_names,
                    scoring_policy=self._scoring_policy,
                )
                span.set_attributes(
                    oi.get_output_attributes(
                        {
                            "results": [
                                {
                                    "name": result["name"],
                                    "label": result["label"],
                                    "score": result["score"],
                                    "explanation": result["explanation"],
                                }
                                for result in results
                            ]
                        }
                    )
                )
                span.set_status(Status(StatusCode.OK))
                return results
            except Exception as error:
                span.set_status(Status(StatusCode.ERROR, str(error)))
                span.record_exception(error)
                return [
                    EvaluationResult(
                        name=annotation_name,
                        annotator_kind="LLM",
                        label=None,
                        score=None,
                        explanation=None,
                        metadata=self.error_metadata,
                        error=str(error),
                        error_exc=error,
                        trace_id=trace_id,
                        start_time=started,
                        end_time=datetime.now(timezone.utc),
                    )
                    for annotation_name in annotation_names
                ]
