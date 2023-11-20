from typing import Optional

import strawberry

import phoenix.trace.v1 as pb
from phoenix.trace.schemas import SpanID


@strawberry.interface
class Evaluation:
    name: str
    score: Optional[float]
    label: Optional[str]
    explanation: Optional[str]


@strawberry.type
class SpanEvaluation(Evaluation):
    span_id: strawberry.Private[SpanID]

    @staticmethod
    def from_pb_evaluation(evaluation: pb.Evaluation) -> "SpanEvaluation":
        result = evaluation.result
        score = result.score.value if result.HasField("score") else None
        label = result.label.value if result.HasField("label") else None
        explanation = result.explanation.value if result.HasField("explanation") else None
        span_id = SpanID(evaluation.subject_id.span_id)
        return SpanEvaluation(
            name=evaluation.name,
            score=score,
            label=label,
            explanation=explanation,
            span_id=span_id,
        )


@strawberry.type
class DocumentEvaluation(Evaluation):
    span_id: strawberry.Private[SpanID]
    document_position: int = strawberry.field(
        description="The zero-based index among retrieved documents, which "
        "is collected as a list (even when ordering is not inherently meaningful)."
    )

    @staticmethod
    def from_pb_evaluation(evaluation: pb.Evaluation) -> "DocumentEvaluation":
        result = evaluation.result
        score = result.score.value if result.HasField("score") else None
        label = result.label.value if result.HasField("label") else None
        explanation = result.explanation.value if result.HasField("explanation") else None
        document_retrieval_id = evaluation.subject_id.document_retrieval_id
        document_position = document_retrieval_id.document_position
        span_id = SpanID(document_retrieval_id.span_id)
        return DocumentEvaluation(
            name=evaluation.name,
            score=score,
            label=label,
            explanation=explanation,
            document_position=document_position,
            span_id=span_id,
        )
