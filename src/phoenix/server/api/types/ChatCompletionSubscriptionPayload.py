from typing import Optional

import strawberry
from strawberry.relay import GlobalID

from .Experiment import Experiment
from .ExperimentRun import ExperimentRun
from .ExperimentRunAnnotation import ExperimentRunAnnotation
from .Span import Span
from .SpanAnnotation import SpanAnnotation


@strawberry.interface
class ChatCompletionSubscriptionPayload:
    dataset_example_id: Optional[GlobalID] = None
    repetition_number: Optional[int] = None


@strawberry.type
class TextChunk(ChatCompletionSubscriptionPayload):
    content: str


@strawberry.type
class FunctionCallChunk(ChatCompletionSubscriptionPayload):
    name: str
    arguments: str


@strawberry.type
class ToolCallChunk(ChatCompletionSubscriptionPayload):
    id: str
    function: FunctionCallChunk


@strawberry.type
class ChatCompletionSubscriptionResult(ChatCompletionSubscriptionPayload):
    span: Optional[Span] = None
    experiment_run: Optional[ExperimentRun] = None


@strawberry.type
class ChatCompletionSubscriptionError(ChatCompletionSubscriptionPayload):
    message: str


@strawberry.type
class ChatCompletionSubscriptionExperiment(ChatCompletionSubscriptionPayload):
    experiment: Experiment


@strawberry.type
class EvaluationChunk(ChatCompletionSubscriptionPayload):
    experiment_run_evaluation: Optional[ExperimentRunAnnotation] = None
    span_evaluation: Optional[SpanAnnotation] = None


@strawberry.type
class ChatCompletionSubscriptionExperimentProgress(ChatCompletionSubscriptionPayload):
    total_runs: int
    runs_completed: int
    runs_failed: int
    total_evals: int
    evals_completed: int
    evals_failed: int
