import strawberry

from phoenix.server.api.types.AnnotationSummary import AnnotationSummary
from phoenix.server.api.types.Experiment import Experiment


@strawberry.type
class ExperimentAnnotationMetricsDataPoint:
    experiment: Experiment
    annotation_summaries: list[AnnotationSummary]


@strawberry.type
class ExperimentAnnotationMetrics:
    names: list[str]
    baseline_experiment: ExperimentAnnotationMetricsDataPoint | None
    recent_experiments: list[ExperimentAnnotationMetricsDataPoint]
