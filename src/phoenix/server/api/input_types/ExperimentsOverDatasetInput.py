"""Inputs for running the playground's tasks over a dataset, one experiment per task."""

from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay.types import GlobalID
from strawberry.scalars import JSON

from phoenix.db.types.identifier import Identifier
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.input_types.ConnectionConfigInput import ConnectionConfigInput
from phoenix.server.api.input_types.EvaluatorPreviewInput import EvaluatorPreviewInput
from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput
from phoenix.server.api.input_types.PlaygroundEvaluatorInput import (
    EvaluatorInputMappingInput,
    PlaygroundEvaluatorInput,
)
from phoenix.server.api.input_types.PromptVersionInput import ChatPromptVersionInput

MAX_TASKS_PER_RUN = 4


@strawberry.input
class PromptTaskInput:
    """A prompt completed for every example, as configured in a playground prompt panel."""

    prompt_version_id: Optional[GlobalID] = None
    prompt_version: ChatPromptVersionInput
    prompt_name: Optional[Identifier] = None
    connection_config: Optional[ConnectionConfigInput] = None
    headers: Optional[JSON] = None
    appended_messages_path: Optional[str] = strawberry.field(
        default=None,
        description="Dot-notation path to messages in dataset example input to append to prompt",
    )
    template_variables_path: Optional[str] = strawberry.field(
        default="input",
        description="Dot-notation path prefix for template variables. Default 'input' means "
        "{{query}} resolves to input.query. Empty string means full paths like "
        "{{input.query}} or {{reference.answer}} are required.",
    )
    stream_model_output: bool = True
    evaluators: list[PlaygroundEvaluatorInput] = strawberry.field(
        default_factory=list,
        description="Dataset evaluators to run on this prompt's outputs",
    )


@strawberry.input
class EvaluatorTaskInput:
    """An evaluator run on every example, judging the example's own output."""

    evaluator: EvaluatorPreviewInput = strawberry.field(
        description="The evaluator, inline or stored, in the shape the evaluator test uses",
    )
    input_mapping: EvaluatorInputMappingInput


@strawberry.input(one_of=True)
class ExperimentTaskInput:
    prompt: Optional[PromptTaskInput] = UNSET
    evaluator: Optional[EvaluatorTaskInput] = UNSET


@strawberry.input
class ExperimentsOverDatasetInput:
    dataset_id: GlobalID
    dataset_version_id: Optional[GlobalID] = None
    split_ids: Optional[list[GlobalID]] = None
    repetitions: int = 1
    max_concurrency: int = strawberry.field(
        default=10,
        description="The concurrency budget of each experiment",
    )
    credentials: Optional[list[GenerativeCredentialInput]] = UNSET
    experiment_name: Optional[str] = None
    experiment_description: Optional[str] = None
    experiment_metadata: Optional[JSON] = None
    create_ephemeral_experiment: Optional[bool] = False
    tasks: list[ExperimentTaskInput] = strawberry.field(
        description="One experiment is created per task, in this order. "
        "The tasks must all be prompts or all be evaluators.",
    )

    def __post_init__(self) -> None:
        if not self.tasks:
            raise BadRequest("At least one task is required")
        if len(self.tasks) > MAX_TASKS_PER_RUN:
            raise BadRequest(f"At most {MAX_TASKS_PER_RUN} tasks can run together")
        kinds = {"prompt" if task.prompt else "evaluator" for task in self.tasks}
        if len(kinds) > 1:
            raise BadRequest("Tasks must all be prompts or all be evaluators")
