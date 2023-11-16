from typing import Optional

import strawberry

import phoenix.trace.v1 as pb


@strawberry.interface
class Evaluation:
    name: str
    score: Optional[float]
    label: Optional[str]
    explanation: Optional[str]


@strawberry.type
class SpanEvaluation(Evaluation):
    span_id: str

    @staticmethod
    def from_pb_evaluation(evaluation: pb.Evaluation) -> "SpanEvaluation":
        result = evaluation.result
        score = result.score.value if result.HasField("score") else None
        label = result.label.value if result.HasField("label") else None
        explanation = result.explanation.value if result.HasField("explanation") else None
        return SpanEvaluation(
            name=evaluation.name,
            score=score,
            label=label,
            explanation=explanation,
            span_id=evaluation.subject_id.span_id,
        )


@strawberry.type
class DocumentEvaluation(Evaluation):
    span_id: str
    document_position: int

    @staticmethod
    def from_pb_evaluation(evaluation: pb.Evaluation) -> "DocumentEvaluation":
        result = evaluation.result
        score = result.score.value if result.HasField("score") else None
        label = result.label.value if result.HasField("label") else None
        explanation = result.explanation.value if result.HasField("explanation") else None
        return DocumentEvaluation(
            name=evaluation.name,
            score=score,
            label=label,
            explanation=explanation,
            span_id=evaluation.subject_id.document_retrieval_id.span_id,
            document_position=evaluation.subject_id.document_retrieval_id.document_position,
        )
