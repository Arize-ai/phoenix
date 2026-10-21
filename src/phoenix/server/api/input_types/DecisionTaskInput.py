"""A decision run over a dataset as an experiment task, as a prompt task runs a prompt."""

from typing import Optional

import strawberry
from strawberry.relay import GlobalID

from phoenix.db.types.decisions import DecisionTaskConfig
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.helpers.decision_versions import validate_inputs, validate_questions
from phoenix.server.api.input_types.DecisionConnectionInput import DecisionConnectionInput
from phoenix.server.api.input_types.DecisionVersionInput import (
    DecisionInputDefinitionInput,
    DecisionQuestionInput,
    DecisionStateInput,
)
from phoenix.server.api.input_types.PlaygroundEvaluatorInput import PlaygroundEvaluatorInput


@strawberry.input(
    description="A decision asked about every example of a dataset, as a prompt task "
    "completes a prompt for every example."
)
class DecisionTaskInput:
    connection: DecisionConnectionInput
    model_name: str
    inputs: list[DecisionInputDefinitionInput] = strawberry.field(
        description="The named inputs the state is built from."
    )
    state: DecisionStateInput
    questions: list[DecisionQuestionInput] = strawberry.field(
        description="The fixed questions asked of every example; at least one is required.",
    )
    input_values_path: Optional[str] = strawberry.field(
        default="input",
        description="Dot-notation path to the object holding the input values, by input "
        "name, as `templateVariablesPath` is for a prompt. Default 'input' means input "
        "`ticket` resolves to input.ticket. Empty string means the whole context, so "
        "values are read as `input`, `reference`, or `metadata`.",
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
            BadRequest: The inputs, state, or questions break a rule.
        """
        try:
            inputs = [definition.to_orm() for definition in self.inputs]
            state = self.state.to_orm()
            validate_inputs(inputs, state)
            questions = [question.to_orm() for question in self.questions]
            validate_questions(questions)
            return DecisionTaskConfig(
                inputs=inputs,
                state=state,
                questions=questions,
                input_values_path=self.input_values_path or "",
            )
        except ValueError as error:
            raise BadRequest(str(error)) from error
