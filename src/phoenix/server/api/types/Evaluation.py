import strawberry

from phoenix.db.models import DocumentAnnotation, TraceAnnotation

from .Annotation import Annotation


@strawberry.type
class TraceEvaluation(Annotation):
    @staticmethod
    def from_sql_trace_annotation(annotation: TraceAnnotation) -> "TraceEvaluation":
        return TraceEvaluation(
            name=annotation.name,
            score=annotation.score,
            label=annotation.label,
            explanation=annotation.explanation,
            created_at=annotation.created_at,
            updated_at=annotation.updated_at,
        )


@strawberry.type
class DocumentEvaluation(Annotation):
    document_position: int = strawberry.field(
        description="The zero-based index among retrieved documents, which "
        "is collected as a list (even when ordering is not inherently meaningful)."
    )

    @staticmethod
    def from_sql_document_annotation(annotation: DocumentAnnotation) -> "DocumentEvaluation":
        return DocumentEvaluation(
            name=annotation.name,
            score=annotation.score,
            label=annotation.label,
            explanation=annotation.explanation,
            document_position=annotation.document_position,
            created_at=annotation.created_at,
            updated_at=annotation.updated_at,
        )
