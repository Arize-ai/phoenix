"""Native decision evaluator runtime, shared by previews and experiments."""

import json
from datetime import datetime, timezone
from typing import Any, Optional, Sequence, cast

import openinference.instrumentation as oi
from opentelemetry.context import Context
from opentelemetry.trace import NoOpTracer, Status, StatusCode, Tracer, format_trace_id

from phoenix.db.types.annotation_configs import OutputConfigType
from phoenix.db.types.decision_evaluators import derive_decision_output_configs
from phoenix.db.types.evaluator_definition import InlineDecisionEvaluatorDefinition
from phoenix.db.types.evaluators import InputMapping
from phoenix.server.api.evaluators import (
    BaseEvaluator,
    EvaluationResult,
    RenderedMessageTooLargeError,
    apply_input_mapping,
)
from phoenix.server.api.helpers.decision_clients import DecisionClient, DecisionRequest
from phoenix.server.api.helpers.decision_evaluators import (
    ErroredDecisionAnnotation,
    decision_annotation_metadata,
    decision_input_schema,
    project_decision_response,
    validate_decision_output_overrides,
)
from phoenix.server.api.helpers.decision_versions import render_state
from phoenix.server.api.helpers.evaluators import result_annotation_names


class DecisionEvaluator(BaseEvaluator):
    def __init__(
        self,
        definition: InlineDecisionEvaluatorDefinition,
        client: DecisionClient,
        *,
        max_request_bytes: Optional[int] = None,
    ):
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
        return decision_input_schema(self.definition.inputs)

    @property
    def output_configs(self) -> Sequence[OutputConfigType]:
        return derive_decision_output_configs(
            self.definition.questions, self.definition.projection_policy
        )

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
    def annotator_kind(self) -> str:
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
        validate_decision_output_overrides(self.definition, output_configs)
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
                return cast(list[EvaluationResult], results)
            except Exception as error:
                span.set_status(Status(StatusCode.ERROR, str(error)))
                span.record_exception(error)
                return [
                    {
                        "name": annotation_name,
                        "annotator_kind": "LLM",
                        "label": None,
                        "score": None,
                        "explanation": None,
                        "metadata": self.error_metadata,
                        "error": str(error),
                        "error_exc": error,
                        "trace_id": trace_id,
                        "start_time": started,
                        "end_time": datetime.now(timezone.utc),
                    }
                    for annotation_name in result_annotation_names(name, output_configs)
                ]
