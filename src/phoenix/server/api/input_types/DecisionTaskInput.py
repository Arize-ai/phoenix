"""A decision run over a dataset as an experiment task, as a prompt task runs a prompt."""

from typing import Optional

import strawberry
from strawberry.relay import GlobalID

from phoenix.db.types.decisions import DecisionTaskConfig
from phoenix.db.types.prompts import PromptTemplateFormat
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.input_types.DecisionConnectionInput import DecisionConnectionInput
from phoenix.server.api.input_types.DecisionVersionInput import (
    DecisionQuestionInput,
    DecisionStateInput,
    to_decision_definition,
)
from phoenix.server.api.input_types.PlaygroundEvaluatorInput import PlaygroundEvaluatorInput


@strawberry.input(
    description="A decision asked about every example of a dataset, as a prompt task "
    "completes a prompt for every example."
)
class DecisionTaskInput:
    connection: DecisionConnectionInput
    model_name: str
    template_format: PromptTemplateFormat = strawberry.field(
        description="How variable tags are read in the state and the question fields."
    )
    state: DecisionStateInput
    questions: list[DecisionQuestionInput] = strawberry.field(
        description="The fixed questions asked of every example; at least one is required.",
    )
    template_variables_path: Optional[str] = strawberry.field(
        default="input",
        description="Dot-notation path to the object holding the variables, by name, as for "
        "a prompt task. Default 'input' means variable `ticket` resolves to input.ticket. "
        "Empty string means the whole context, so variables are read as `input`, "
        "`reference`, or `metadata`. Values keep their JSON types; unused fields are ignored.",
    )
    evaluators: list[PlaygroundEvaluatorInput] = strawberry.field(
        default_factory=list,
        description="Dataset evaluators to run on this decision's runs",
    )
    decision_version_id: Optional[GlobalID] = strawberry.field(
        default=None,
        description="The saved version this definition was copied from, as a prompt task's "
        "promptVersionId. It is recorded, not read: the definition given here is what runs.",
    )

    def to_config(self) -> DecisionTaskConfig:
        """The config copied into the experiment.

        Raises:
            BadRequest: The state template or questions break a rule.
        """
        try:
            state, questions = to_decision_definition(
                self.template_format, self.state, self.questions
            )
            return DecisionTaskConfig(
                template_format=self.template_format,
                state=state,
                questions=questions,
                template_variables_path=self.template_variables_path or "",
            )
        except ValueError as error:
            raise BadRequest(str(error)) from error
