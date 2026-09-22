"""Inputs for running the playground's tasks over a dataset, one experiment per task."""

from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay.types import GlobalID
from strawberry.scalars import JSON

from phoenix.db.types.evaluator_definition import EvaluatorSource
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
class EvaluatorTaskSourceInput:
    """The saved evaluator a task was opened from, recorded on the frozen definition."""

    evaluator_id: Optional[GlobalID] = None
    prompt_version_id: Optional[GlobalID] = None
    dataset_evaluator_id: Optional[GlobalID] = None
    project_evaluator_id: Optional[GlobalID] = None

    def to_source(self) -> EvaluatorSource:
        return EvaluatorSource(
            evaluator_id=_optional_node_id(self.evaluator_id, ("LLMEvaluator", "CodeEvaluator")),
            prompt_version_id=_optional_node_id(self.prompt_version_id, ("PromptVersion",)),
            dataset_evaluator_id=_optional_node_id(
                self.dataset_evaluator_id, ("DatasetEvaluator",)
            ),
            project_evaluator_id=_optional_node_id(
                self.project_evaluator_id, ("ProjectEvaluator",)
            ),
        )


def _optional_node_id(global_id: Optional[GlobalID], type_names: tuple[str, ...]) -> Optional[int]:
    if global_id is None:
        return None
    if global_id.type_name not in type_names:
        raise BadRequest(
            f"Expected a {' or '.join(type_names)} id, got {global_id.type_name}: {global_id}"
        )
    return int(global_id.node_id)


@strawberry.input
class EvaluatorTaskInput:
    """An evaluator run on every example, judging the example as the span it came from."""

    evaluator: EvaluatorPreviewInput = strawberry.field(
        description="The evaluator, inline or stored, in the shape the evaluator test uses",
    )
    input_mapping: EvaluatorInputMappingInput
    source: Optional[EvaluatorTaskSourceInput] = strawberry.field(
        default=None,
        description="The saved evaluator, prompt version and dataset or project binding the "
        "task was opened from, kept on the experiment so its calibration can be traced back.",
    )


@strawberry.input(one_of=True)
class ExperimentTaskInput:
    prompt: Optional[PromptTaskInput] = UNSET
    evaluator: Optional[EvaluatorTaskInput] = UNSET


@strawberry.input
class ExperimentsOverDatasetInput:
    dataset_id: GlobalID
    dataset_version_id: Optional[GlobalID] = None
    split_ids: Optional[list[GlobalID]] = None
    example_ids: Optional[list[GlobalID]] = strawberry.field(
        default=None,
        description="Run only these examples of the dataset, as a row's play button does; "
        "every example of the dataset or its splits when omitted.",
    )
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
