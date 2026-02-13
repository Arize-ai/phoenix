from typing import Optional

import strawberry
from strawberry.relay import GlobalID

from .Experiment import Experiment
from .ExperimentRun import ExperimentRun
from .ExperimentRunAnnotation import ExperimentRunAnnotation
from .Span import Span
from .Trace import Trace


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
class ImageChunk(ChatCompletionSubscriptionPayload):
    """Chunk containing base64-encoded image data."""

    data: str  # base64-encoded image data
    mime_type: str  # e.g., "image/png", "image/jpeg"


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
    evaluator_name: str
    experiment_run_evaluation: Optional[ExperimentRunAnnotation] = None
    trace: Optional[Trace] = None
    error: Optional[str] = None
