from dataclasses import dataclass
from typing import Dict, Hashable, List, Mapping, Protocol, Set, Tuple, TypeVar

import numpy as np
import numpy.typing as npt
from typing_extensions import TypeAlias

Identifier = TypeVar("Identifier", bound=Hashable)
Vector: TypeAlias = npt.NDArray[np.float64]
Matrix: TypeAlias = npt.NDArray[np.float64]
ClusterId: TypeAlias = int
RowIndex: TypeAlias = int
Cluster: TypeAlias = Set[RowIndex]


class DimensionalityReducer(Protocol):
    def project(self, mat: Matrix, n_components: int) -> Matrix:
        ...


class ClustersFinder(Protocol):
    def find_clusters(self, mat: Matrix) -> List[Cluster]:
        ...


@dataclass(frozen=True)
class PointCloud:
    dimensionalityReducer: DimensionalityReducer
    clustersFinder: ClustersFinder

    def generate(
        self,
        vectors: Mapping[Identifier, Vector],
        n_components: int,
    ) -> Tuple[Dict[Identifier, Vector], Dict[Identifier, ClusterId]]:
        all_identifiers, all_vectors = zip(*vectors.items())
        projections = self.dimensionalityReducer.project(
            np.stack(all_vectors), n_components=n_components
        )
        clusters = self.clustersFinder.find_clusters(projections)
        return dict(zip(all_identifiers, projections)), {
            all_identifiers[row_index]: cluster_id
            for cluster_id, cluster in enumerate(clusters)
            for row_index in cluster
        }
