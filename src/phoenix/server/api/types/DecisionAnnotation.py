"""A decision judge's result on an annotation, typed from the annotation's metadata."""

from enum import Enum
from typing import Any, Optional

import strawberry
from strawberry.relay import GlobalID

from phoenix.server.api.helpers import decision_evaluators as metadata
from phoenix.server.api.types.DecisionAnswer import DecisionAnswer, to_gql_answer
from phoenix.server.api.types.DecisionDefinition import DecisionChoiceOption, DecisionScaleLevel
from phoenix.server.api.types.DecisionProjectionPolicy import (
    DecisionQuestionProjection,
    to_gql_question_projection,
)
from phoenix.server.api.types.EvaluatorTaskDefinition import (
    EvaluatorTaskSource,
    to_gql_evaluator_source,
)
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey


@strawberry.enum
class DecisionAnnotationStatus(Enum):
    ANSWERED = "answered"
    REFUSED = "refused"
    ERROR = "error"


@strawberry.enum
class DecisionAnnotationQuestionType(Enum):
    PREDICATE = "predicate"
    CHOICE = "choice"
    SCALE = "scale"


@strawberry.type(description="The question a decision judge asked, as it asked it.")
class DecisionAnnotationQuestion:
    name: str
    type: DecisionAnnotationQuestionType
    choices: Optional[list[DecisionChoiceOption]] = strawberry.field(
        description="A choice question's options, in order; null for other types."
    )
    levels: Optional[list[DecisionScaleLevel]] = strawberry.field(
        description="A scale's levels, from the lowest; null for other types."
    )


@strawberry.type(
    description=(
        "A decision judge's result for one question, read from the annotation's "
        "`metadata.decision`. Metadata is ordinary JSON, so this describes its format, not "
        "which evaluator wrote it."
    )
)
class DecisionAnnotation:
    status: DecisionAnnotationStatus
    question: Optional[DecisionAnnotationQuestion] = strawberry.field(
        description="Null when the call failed."
    )
    answer: Optional[DecisionAnswer] = strawberry.field(
        description="The normalized answer, a refusal included; null when the call failed."
    )
    projection: Optional[DecisionQuestionProjection] = strawberry.field(
        description="The scoring settings applied to the answer; null when the call failed."
    )
    requested_model: Optional[str]
    resolved_model: Optional[str]
    model_provider: Optional[GenerativeProviderKey]
    custom_provider_id: Optional[GlobalID]
    source: Optional[EvaluatorTaskSource] = strawberry.field(
        description="The judge, decision version, and binding that produced the result."
    )


def to_gql_decision_annotation(decision: metadata.DecisionAnnotation) -> DecisionAnnotation:
    source = to_gql_evaluator_source(decision.source, "DecisionEvaluator")
    if isinstance(decision, metadata.ErroredDecisionAnnotation):
        return DecisionAnnotation(
            status=DecisionAnnotationStatus.ERROR,
            question=None,
            answer=None,
            projection=None,
            requested_model=None,
            resolved_model=None,
            model_provider=None,
            custom_provider_id=None,
            source=source,
        )
    question = decision.question
    choice_order = [choice.value for choice in question.choices] if question.choices else None
    return DecisionAnnotation(
        status=DecisionAnnotationStatus(decision.status),
        question=DecisionAnnotationQuestion(
            name=question.name,
            type=DecisionAnnotationQuestionType(question.type),
            choices=[
                DecisionChoiceOption(value=choice.value, description=choice.description)
                for choice in question.choices
            ]
            if question.choices is not None
            else None,
            levels=[
                DecisionScaleLevel(label=level.label, description=level.description)
                for level in question.levels
            ]
            if question.levels is not None
            else None,
        ),
        answer=to_gql_answer(question.name, decision.answer, choice_order),
        projection=to_gql_question_projection(question.name, decision.projection, choice_order),
        requested_model=decision.requested_model,
        resolved_model=decision.resolved_model,
        model_provider=GenerativeProviderKey.from_model_provider(decision.provider),
        custom_provider_id=GlobalID(
            "GenerativeModelCustomProvider", str(decision.custom_provider_id)
        )
        if decision.custom_provider_id is not None
        else None,
        source=source,
    )


def decision_annotation_from_metadata(annotation_metadata: Any) -> Optional[DecisionAnnotation]:
    """The typed `decision` field of any annotation, from its metadata."""
    decision = metadata.parse_decision_annotation(annotation_metadata)
    return to_gql_decision_annotation(decision) if decision is not None else None
