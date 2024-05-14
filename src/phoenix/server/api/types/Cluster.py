from collections import Counter, defaultdict
from typing import Dict, List, Mapping, Optional, Set

import strawberry
from strawberry import ID
from strawberry.types import Info

from phoenix.core.model_schema import PRIMARY, REFERENCE
from phoenix.server.api.context import Context
from phoenix.server.api.input_types.DataQualityMetricInput import DataQualityMetricInput
from phoenix.server.api.input_types.PerformanceMetricInput import PerformanceMetricInput
from phoenix.server.api.types.DatasetValues import DatasetValues
from phoenix.server.api.types.Event import unpack_event_id
from phoenix.server.api.types.InferencesRole import AncillaryInferencesRole, InferencesRole


@strawberry.type
class Cluster:
    """A grouping of points in a UMAP plot"""

    id: ID = strawberry.field(
        description="The ID of the cluster",
    )

    event_ids: List[ID] = strawberry.field(
        description="The event IDs of the points in the cluster",
    )

    @strawberry.field(
        description="Ratio of primary points over reference points",
    )  # type: ignore
    def drift_ratio(
        self,
        info: Info[Context, None],
    ) -> Optional[float]:
        """
        Calculates the drift score of the cluster. The score will be a value
        representing the balance of points between the primary and the reference
        inferences, and will be on a scale between 1 (all primary) and -1 (all
        reference), with 0 being an even balance between the two inference sets.

        Returns
        -------
        drift_ratio : Optional[float]
        """
        model = info.context.model
        if model[REFERENCE].empty:
            return None
        count_by_role = Counter(unpack_event_id(event_id)[1] for event_id in self.event_ids)
        primary_count = count_by_role[InferencesRole.primary]
        reference_count = count_by_role[InferencesRole.reference]
        return (
            None
            if not (denominator := (primary_count + reference_count))
            else (primary_count - reference_count) / denominator
        )

    @strawberry.field(
        description="Ratio of primary points over corpus points",
    )  # type: ignore
    def primary_to_corpus_ratio(
        self,
        info: Info[Context, None],
    ) -> Optional[float]:
        """
        Calculates a score representing the balance of points between the
        primary and the corpus datasets, and will be on a scale between 1
        (all primary) and -1 (all corpus), with 0 being an even balance
        between the two datasets.

        Returns
        -------
        drift_ratio : Optional[float]
        """
        corpus = info.context.corpus
        if corpus is None or corpus[PRIMARY].empty:
            return None
        count_by_role = Counter(unpack_event_id(event_id)[1] for event_id in self.event_ids)
        primary_count = count_by_role[InferencesRole.primary]
        corpus_count = count_by_role[AncillaryInferencesRole.corpus]
        return (
            None
            if not (denominator := (primary_count + corpus_count))
            else (primary_count - corpus_count) / denominator
        )

    @strawberry.field(
        description="Data quality metric summarized by the respective "
        "datasets of the clustered events",
    )  # type: ignore
    def data_quality_metric(
        self,
        info: Info[Context, None],
        metric: DataQualityMetricInput,
    ) -> DatasetValues:
        model = info.context.model
        row_ids: Dict[InferencesRole, List[int]] = defaultdict(list)
        for row_id, inferences_role in map(unpack_event_id, self.event_ids):
            if not isinstance(inferences_role, InferencesRole):
                continue
            row_ids[inferences_role].append(row_id)
        return DatasetValues(
            primary_value=metric.metric_instance(
                model[PRIMARY],
                subset_rows=row_ids[InferencesRole.primary],
            ),
            reference_value=metric.metric_instance(
                model[REFERENCE],
                subset_rows=row_ids[InferencesRole.reference],
            ),
        )

    @strawberry.field(
        description="Performance metric summarized by the respective "
        "datasets of the clustered events",
    )  # type: ignore
    def performance_metric(
        self,
        info: Info[Context, None],
        metric: PerformanceMetricInput,
    ) -> DatasetValues:
        model = info.context.model
        row_ids: Dict[InferencesRole, List[int]] = defaultdict(list)
        for row_id, inferences_role in map(unpack_event_id, self.event_ids):
            if not isinstance(inferences_role, InferencesRole):
                continue
            row_ids[inferences_role].append(row_id)
        metric_instance = metric.metric_instance(model)
        return DatasetValues(
            primary_value=metric_instance(
                model[PRIMARY],
                subset_rows=row_ids[InferencesRole.primary],
            ),
            reference_value=metric_instance(
                model[REFERENCE],
                subset_rows=row_ids[InferencesRole.reference],
            ),
        )


def to_gql_clusters(
    clustered_events: Mapping[str, Set[ID]],
) -> List[Cluster]:
    """
    Converts a dictionary of event IDs to cluster IDs to a list of clusters
    for the graphQL response

    Parameters
    ----------
    clustered_events: Mapping[str, Set[ID]]
        A mapping of cluster ID to its set of event IDs
    """

    return [
        Cluster(
            id=ID(cluster_id),
            event_ids=list(event_ids),
        )
        for cluster_id, event_ids in clustered_events.items()
    ]
