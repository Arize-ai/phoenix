from collections import defaultdict
from typing import Dict, Iterable, List, Mapping, Optional, TypeVar

from phoenix.core.model_schema import PRIMARY, REFERENCE, DatasetRole, EventId, Model
from phoenix.metrics import Metric
from phoenix.server.api.types.DatasetValues import DatasetValues

T = TypeVar("T")


def ensure_list(obj: Optional[Iterable[T]]) -> List[T]:
    if isinstance(obj, List):
        return obj
    if isinstance(obj, Iterable):
        return list(obj)
    return []


def compute_metric_by_cluster(
    cluster_membership: Mapping[EventId, int],
    metric: Metric,
    model: Model,
) -> Dict[int, DatasetValues]:
    ans = {}
    row_ids_by_cluster: Dict[int, Dict[DatasetRole, List[int]]] = defaultdict(
        lambda: defaultdict(list)
    )
    for event_id, cluster_id in cluster_membership.items():
        row_id, dataset_role = event_id
        row_ids_by_cluster[cluster_id][dataset_role].append(row_id)
    for cluster_id, dataset_row_ids in row_ids_by_cluster.items():
        ans[cluster_id] = DatasetValues(
            primary_value=metric(
                model[PRIMARY],
                subset_rows=dataset_row_ids[PRIMARY],
            ),
            reference_value=metric(
                model[REFERENCE],
                subset_rows=dataset_row_ids[REFERENCE],
            ),
        )
    return ans
