"""Base evaluator contract, evaluation results, and shared runtime errors."""

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Hashable, Literal, Optional, Protocol, Sequence, TypeAlias

from opentelemetry.trace import Tracer
from typing_extensions import NotRequired, TypedDict

from phoenix.db.types.annotation_configs import OutputConfigType
from phoenix.db.types.evaluators import InputMapping
from phoenix.server.online_eval.failure_policy import FailureDisposition


class RenderedMessageTooLargeError(Exception):
    """Rendered LLM or decision messages exceed the configured online-eval limit."""

    online_eval_disposition = FailureDisposition(
        count_attempt=True,
        terminal=True,
        code="RENDERED_MESSAGE_TOO_LARGE",
    )


EvaluatorAnnotatorKind: TypeAlias = Literal["LLM", "CODE"]


class EvaluationResult(TypedDict):
    name: str
    annotator_kind: EvaluatorAnnotatorKind
    label: Optional[str]
    score: Optional[float]
    explanation: Optional[str]
    metadata: dict[str, Any]
    error: Optional[str]
    trace_id: Optional[str]
    start_time: datetime
    end_time: datetime
    error_exc: NotRequired[Optional[Exception]]


class EvaluatorProviderClient(Protocol):
    def get_rate_limit_key(self) -> Hashable: ...
    def is_rate_limit_error(self, error: Exception) -> bool: ...
    def is_transient_error(self, error: Exception) -> bool: ...


def result_annotation_names(
    evaluator_name: str,
    output_configs: Sequence[OutputConfigType],
) -> list[str]:
    """The annotation names an evaluator's results are stored under, in config order.

    A single output config writes under the evaluator's own name; multiple
    write under "{evaluator_name}.{config_name}". This is the storage contract
    `BaseEvaluator.evaluate` implements and the online-eval executor validates
    against; the frontend mirrors it in useProjectEvaluatorResultAnnotations.ts.
    An evaluator with no output configs still writes under its own name.
    """
    if len(output_configs) > 1:
        return [f"{evaluator_name}.{config.name}" for config in output_configs]
    return [evaluator_name]


class BaseEvaluator(ABC):
    """
    Base interface for all evaluators that attach annotations to tasks.

    This is the unified ABC that LLMEvaluator, DecisionEvaluator, CodeEvaluatorRunner,
    and BuiltInEvaluator implement.
    """

    @property
    def provider_client(self) -> Optional[EvaluatorProviderClient]:
        return None

    @property
    def annotator_kind(self) -> EvaluatorAnnotatorKind:
        return "CODE"

    @property
    def error_metadata(self) -> dict[str, Any]:
        """Metadata for an errored annotation, including errors the runner records."""
        return {}

    @property
    @abstractmethod
    def name(self) -> str:
        """The display name of this evaluator."""
        ...

    @property
    @abstractmethod
    def description(self) -> Optional[str]:
        """Optional description of what this evaluator does."""
        ...

    @property
    @abstractmethod
    def input_schema(self) -> dict[str, Any]:
        """Returns the JSON schema describing the input format for this evaluator."""
        ...

    @property
    @abstractmethod
    def output_configs(self) -> Sequence[OutputConfigType]:
        """Returns the output configurations for this evaluator."""
        ...

    @abstractmethod
    async def evaluate(
        self,
        *,
        context: dict[str, Any],
        input_mapping: InputMapping,
        name: str,
        output_configs: Sequence[OutputConfigType],
        tracer: Optional[Tracer] = None,
    ) -> list[EvaluationResult]:
        """
        Evaluate the given context and return evaluation results.

        Produces one EvaluationResult per output config. For LLM evaluators, this
        is done with a single LLM call that returns multiple tool calls matched to
        configs by name. For built-in evaluators, each config is evaluated independently.

        Annotation naming: when there are multiple output configs (K>1), each result
        is named ``name.config_name``. When there is a single output config (K=1),
        the result is named ``name``.

        Args:
            context: The evaluation context containing input data.
            input_mapping: Mapping configuration for inputs.
            name: The evaluator name used for annotation naming.
            output_configs: Configurations for the evaluation outputs.
            tracer: Optional OpenTelemetry tracer for recording spans.
                   If provided, the caller is responsible for managing the tracer
                   and retrieving any recorded spans after evaluation.
        """
        ...
