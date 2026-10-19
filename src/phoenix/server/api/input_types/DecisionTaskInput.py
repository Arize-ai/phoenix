"""A decision model run over a dataset as an experiment task."""

from enum import Enum
from typing import Optional

import strawberry
from pydantic import ValidationError
from strawberry import UNSET

from phoenix.db.types.decisions import (
    DecisionReferences,
    DecisionScoring,
    DecisionTaskConfig,
    ExampleQuestions,
    FixedQuestions,
)
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.helpers.decision_experiments import validate_reference_template
from phoenix.server.api.helpers.decision_versions import validate_inputs, validate_questions
from phoenix.server.api.input_types.DecisionConnectionInput import DecisionConnectionInput
from phoenix.server.api.input_types.DecisionVersionInput import (
    DecisionInputDefinitionInput,
    DecisionQuestionInput,
    DecisionStateInput,
)
from phoenix.server.api.input_types.PlaygroundEvaluatorInput import EvaluatorInputMappingInput
from phoenix.server.api.types.AnnotatorKind import AnnotatorKind


@strawberry.enum(description="How questions stored in a dataset example are written.")
class DecisionQuestionFormat(Enum):
    PHOENIX = "phoenix"
    SYSTEM_ONE = "system_one"
    OPENAI = "openai"


@strawberry.input(description="Each example carries its own questions, as a benchmark does.")
class ExampleQuestionsInput:
    path: str = strawberry.field(
        description="Where the questions are in the example's evaluation context, such as "
        "`input.questions`."
    )
    format: DecisionQuestionFormat = DecisionQuestionFormat.SYSTEM_ONE


@strawberry.input(one_of=True, description="Where each example's questions come from.")
class DecisionQuestionSourceInput:
    fixed: Optional[list[DecisionQuestionInput]] = strawberry.field(
        default=UNSET, description="The same questions for every example."
    )
    example: Optional[ExampleQuestionsInput] = UNSET


@strawberry.input(
    description=(
        "Where each question's reference answer is in an example. `{question}` in a path "
        "stands for the question's name, such as `reference.{question}.label`. A missing or "
        "unreadable reference is skipped and counted, never scored."
    )
)
class DecisionReferencesInput:
    label_path: Optional[str] = strawberry.field(
        default=None,
        description="The expected answer: a choice value, true or false, or a level.",
    )
    distribution_path: Optional[str] = strawberry.field(
        default=None, description="A reference distribution over the answers."
    )
    annotator_kind: AnnotatorKind = strawberry.field(
        description="Who wrote the references: accuracy against HUMAN ones, agreement against "
        "a model's."
    )


@strawberry.input(description="Settings that change scores without changing what was asked.")
class DecisionScoringInput:
    predicate_threshold: float = strawberry.field(
        default=0.5, description="A predicate counts as true at or above this probability."
    )


@strawberry.input(description="A decision model asked about every example of a dataset.")
class DecisionTaskInput:
    connection: DecisionConnectionInput
    model_name: str
    inputs: list[DecisionInputDefinitionInput] = strawberry.field(
        description="The named inputs the state is built from."
    )
    state: DecisionStateInput
    input_mapping: EvaluatorInputMappingInput = strawberry.field(
        description="Where each input's value is in the example's evaluation context."
    )
    questions: DecisionQuestionSourceInput
    references: Optional[DecisionReferencesInput] = None
    scoring: Optional[DecisionScoringInput] = None

    def to_config(self) -> DecisionTaskConfig:
        """The config frozen with the experiment.

        Raises:
            BadRequest: The inputs, state, questions, or reference paths break a rule.
        """
        try:
            inputs = [definition.to_orm() for definition in self.inputs]
            state = self.state.to_orm()
            validate_inputs(inputs, state)
            questions: FixedQuestions | ExampleQuestions
            if self.questions.fixed:
                fixed = [question.to_orm() for question in self.questions.fixed]
                validate_questions(fixed)
                questions = FixedQuestions(type="fixed", questions=fixed)
            elif self.questions.example:
                questions = ExampleQuestions(
                    type="example",
                    path=self.questions.example.path,
                    format=self.questions.example.format.value,
                )
            else:
                raise ValueError("Questions are required: fixed or example")
            references = None
            if self.references:
                if not (self.references.label_path or self.references.distribution_path):
                    raise ValueError("References need a labelPath or a distributionPath")
                for template in (self.references.label_path, self.references.distribution_path):
                    if template:
                        validate_reference_template(template)
                references = DecisionReferences(
                    label_path=self.references.label_path,
                    distribution_path=self.references.distribution_path,
                    annotator_kind=self.references.annotator_kind.value,
                )
            scoring = (
                DecisionScoring(predicate_threshold=self.scoring.predicate_threshold)
                if self.scoring
                else DecisionScoring()
            )
            if not 0 <= scoring.predicate_threshold <= 1:
                raise ValueError("predicateThreshold must be from 0 to 1")
            return DecisionTaskConfig(
                inputs=inputs,
                state=state,
                input_mapping=self.input_mapping.to_orm(),
                questions=questions,
                references=references,
                scoring=scoring,
            )
        except ValidationError as error:
            raise BadRequest(str(error.errors()[0]["msg"])) from error
        except ValueError as error:
            raise BadRequest(str(error)) from error
