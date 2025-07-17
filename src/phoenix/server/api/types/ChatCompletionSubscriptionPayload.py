from typing import Optional

import strawberry
from strawberry.relay import GlobalID

from .Experiment import Experiment
from .ExperimentRun import ExperimentRun
from .Span import Span


@strawberry.interface
class ChatCompletionSubscriptionPayload:
    dataset_example_id: Optional[GlobalID] = None


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
