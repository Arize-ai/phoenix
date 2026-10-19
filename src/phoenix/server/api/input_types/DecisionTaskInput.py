"""A decision run over a dataset as an experiment task, as a prompt task runs a prompt."""

from enum import Enum
from typing import Optional

import strawberry
from pydantic import ValidationError

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


@strawberry.enum(description="How questions stored in a dataset example are written.")
class DecisionQuestionFormat(Enum):
    PHOENIX = "phoenix"
    SYSTEM_ONE = "system_one"
    OPENAI = "openai"


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
        default_factory=list,
        description="The questions asked of every example. Leave empty when "
        "`questionsPath` reads each example's own.",
    )
    input_values_path: Optional[str] = strawberry.field(
        default="input",
        description="Dot-notation path to the object holding the input values, by input "
        "name, as `templateVariablesPath` is for a prompt. Default 'input' means input "
        "`ticket` resolves to input.ticket. Empty string means the whole context, so "
        "values are read as `input`, `reference`, or `metadata`.",
    )
    questions_path: Optional[str] = strawberry.field(
        default=None,
        description="Dot-notation path to each example's own questions in its input, as "
        "`appendedMessagesPath` is for a prompt. For benchmarks whose questions vary per "
        "example.",
    )
    questions_format: DecisionQuestionFormat = strawberry.field(
        default=DecisionQuestionFormat.SYSTEM_ONE,
        description="How the questions at `questionsPath` are written.",
    )
    evaluators: list[PlaygroundEvaluatorInput] = strawberry.field(
        default_factory=list,
        description="Dataset evaluators to run on this decision's runs",
    )

    def to_config(self) -> DecisionTaskConfig:
        """The config copied into the experiment.

        Raises:
            BadRequest: The inputs, state, or questions break a rule, or questions are
                given both inline and by path.
        """
        try:
            inputs = [definition.to_orm() for definition in self.inputs]
            state = self.state.to_orm()
            validate_inputs(inputs, state)
            questions = [question.to_orm() for question in self.questions]
            if self.questions_path:
                if questions:
                    raise ValueError(
                        "Give questions or a questionsPath, not both: each example's "
                        "questions replace the task's"
                    )
            else:
                validate_questions(questions)
            return DecisionTaskConfig(
                inputs=inputs,
                state=state,
                questions=questions,
                input_values_path=self.input_values_path or "",
                questions_path=self.questions_path or None,
                questions_format=self.questions_format.value,
            )
        except ValidationError as error:
            raise BadRequest(str(error.errors()[0]["msg"])) from error
        except ValueError as error:
            raise BadRequest(str(error)) from error
