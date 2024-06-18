import strawberry


@strawberry.type
class ExperimentAnnotationSummary:
    annotation_name: str
    mean_score: float
    experiment_id: strawberry.Private[int]
