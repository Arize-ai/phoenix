from collections import Counter, defaultdict
from typing import Dict, List, Mapping, Optional, Set

import numpy as np
import strawberry
from strawberry import ID
from strawberry.types import Info
from typing_extensions import Annotated

from phoenix.core.model_schema import PRIMARY, REFERENCE, DatasetRole, EventId
from phoenix.server.api.context import Context
from phoenix.server.api.input_types.DataQualityMetricInput import DataQualityMetricInput
from phoenix.server.api.types.DatasetValues import DatasetValues


@strawberry.type
class Cluster:
    """A grouping of points in a UMAP plot"""

    id: ID = strawberry.field(
        description="The ID of the cluster",
    )

    events: strawberry.Private[Set[EventId]]
    has_reference_data: strawberry.Private[bool]

    @strawberry.field
    def event_ids(self) -> List[ID]:
        return [ID(str(event)) for event in self.events]

    @strawberry.field(
        description="""ratio of primary points over reference points""",
    )  # type: ignore
    def drift_ratio(self) -> Optional[float]:
        """
        Calculates the drift score of the cluster. The score will be a value
        representing the balance of points between the primary and the reference
        datasets, and will be on a scale between 1 (all primary) and -1 (all
        reference), with 0 being an even balance between the two datasets.

        Returns
        -------
        drift_ratio : Optional[float]
        """
        if not self.has_reference_data:
            return None
        return (
            np.nan
            if not (cnt := Counter(e.dataset_id for e in self.events))
            else (cnt[PRIMARY] - cnt[REFERENCE]) / (cnt[PRIMARY] + cnt[REFERENCE])
        )

    @strawberry.field
    def data_quality_metric(
        self,
        info: Info[Context, None],
        metric: Annotated[
            DataQualityMetricInput,
            strawberry.argument(
                description="Data quality metric summarized by the respective "
                "datasets of the clustered events",
            ),
        ],
    ) -> DatasetValues:
        model = info.context.model
        row_ids: Dict[DatasetRole, List[int]] = defaultdict(list)
        for event in self.events:
            row_ids[event.dataset_id].append(event.row_id)
        return DatasetValues(
            primary_value=metric.metric_instance(
                model[PRIMARY],
                subset_rows=row_ids[PRIMARY],
            ),
            reference_value=metric.metric_instance(
                model[REFERENCE],
                subset_rows=row_ids[REFERENCE],
            ),
        )


def to_gql_clusters(
    clustered_events: Mapping[int, Set[EventId]],
    has_reference_data: bool,
) -> List[Cluster]:
    """
    Converts a dictionary of event IDs to cluster IDs to a list of clusters
    for the graphQL response

    Parameters
    ----------
    cluster_membership: Mapping[int, Set[EventId]]
        A mapping of cluster ID to its set of event IDs
    has_reference_data: bool
        Whether or not the model has reference data
        Used to determine if drift ratio should be calculated
    """

    return [
        Cluster(
            id=ID(str(cluster_id)),
            events=events,
            has_reference_data=has_reference_data,
        )
        for cluster_id, events in clustered_events.items()
    ]
