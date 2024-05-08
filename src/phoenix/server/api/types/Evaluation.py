from typing import Optional

import strawberry

import phoenix.trace.v1 as pb
from phoenix.db.models import DocumentAnnotation, SpanAnnotation, TraceAnnotation


@strawberry.interface
class Evaluation:
    name: str = strawberry.field(
        description="Name of the evaluation, e.g. 'helpfulness' or 'relevance'."
    )
    score: Optional[float] = strawberry.field(
        description="Result of the evaluation in the form of a numeric score."
    )
    label: Optional[str] = strawberry.field(
        description="Result of the evaluation in the form of a string, e.g. "
        "'helpful' or 'not helpful'. Note that the label is not necessarily binary."
    )
    explanation: Optional[str] = strawberry.field(
        description="The evaluator's explanation for the evaluation result (i.e. "
        "score or label, or both) given to the subject."
    )


@strawberry.type
class TraceEvaluation(Evaluation):
    @staticmethod
    def from_pb_evaluation(evaluation: pb.Evaluation) -> "TraceEvaluation":
        result = evaluation.result
        score = result.score.value if result.HasField("score") else None
        label = result.label.value if result.HasField("label") else None
        explanation = result.explanation.value if result.HasField("explanation") else None
        return TraceEvaluation(
            name=evaluation.name,
            score=score,
            label=label,
            explanation=explanation,
        )

    @staticmethod
    def from_sql_trace_annotation(annotation: TraceAnnotation) -> "TraceEvaluation":
        return TraceEvaluation(
            name=annotation.name,
            score=annotation.score,
            label=annotation.label,
            explanation=annotation.explanation,
        )


@strawberry.type
class SpanEvaluation(Evaluation):
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
        )

    @staticmethod
    def from_sql_span_annotation(annotation: SpanAnnotation) -> "SpanEvaluation":
        return SpanEvaluation(
            name=annotation.name,
            score=annotation.score,
            label=annotation.label,
            explanation=annotation.explanation,
        )


@strawberry.type
class DocumentEvaluation(Evaluation):
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
        return DocumentEvaluation(
            name=evaluation.name,
            score=score,
            label=label,
            explanation=explanation,
            document_position=document_position,
        )

    @staticmethod
    def from_sql_document_annotation(annotation: DocumentAnnotation) -> "DocumentEvaluation":
        return DocumentEvaluation(
            name=annotation.name,
            score=annotation.score,
            label=annotation.label,
            explanation=annotation.explanation,
            document_position=annotation.document_position,
        )
