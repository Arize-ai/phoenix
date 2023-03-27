from dataclasses import dataclass
from typing import Dict, Hashable, List, Mapping, Protocol, Tuple, TypeVar

import numpy as np
import numpy.typing as npt
from typing_extensions import TypeAlias

from phoenix.pointcloud.clustering import RawCluster

Vector: TypeAlias = npt.NDArray[np.float64]
Matrix: TypeAlias = npt.NDArray[np.float64]
RowIndex: TypeAlias = int
Identifier = TypeVar("Identifier", bound=Hashable)
ClusterId: TypeAlias = int


class DimensionalityReducer(Protocol):
    def project(self, mat: Matrix, n_components: int) -> Matrix:
        ...


class ClustersFinder(Protocol):
    def find_clusters(self, mat: Matrix) -> List[RawCluster]:
        ...


@dataclass(frozen=True)
class PointCloud:
    dimensionalityReducer: DimensionalityReducer
    clustersFinder: ClustersFinder

    def generate(
        self,
        data: Mapping[Identifier, Vector],
        n_components: int = 3,
    ) -> Tuple[Dict[Identifier, Vector], Dict[Identifier, ClusterId]]:
        """
        Given a set of vectors, projects them onto lower dimensions, and
        finds clusters among the projections.

        Parameters
        ----------
        data : mapping
            Mapping of input vectors by their identifiers.

        n_components: int, default=3
            Number of dimensions in the projected space.

        Returns
        -------
        projections : dictionary
            Projected vectors in the low dimensional space, mapped back to the
            input vectors' identifiers.

        cluster_membership: dictionary
            Cluster membership by way of cluster_ids in the form of integers
            0,1,2,... mapped back to the input vectors' identifiers. Note that
            some vectors may not belong to any cluster and are excluded here.

        """

        if not data:
            return {}, {}
        identifiers, vectors = zip(*data.items())
        projections = self.dimensionalityReducer.project(np.stack(vectors), n_components=n_components)
        clusters = self.clustersFinder.find_clusters(projections)
        return dict(zip(identifiers, projections)), {
            identifiers[row_index]: cluster_id for cluster_id, cluster in enumerate(clusters) for row_index in cluster
        }
