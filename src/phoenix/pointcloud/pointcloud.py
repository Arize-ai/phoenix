from dataclasses import dataclass
from typing import Dict, List, Mapping, Protocol, Set, Tuple

import numpy as np
import numpy.typing as npt
from strawberry import ID
from typing_extensions import TypeAlias

from phoenix.pointcloud.clustering import RawCluster

Vector: TypeAlias = npt.NDArray[np.float64]
Matrix: TypeAlias = npt.NDArray[np.float64]
RowIndex: TypeAlias = int


class DimensionalityReducer(Protocol):
    def project(self, mat: Matrix, n_components: int) -> Matrix: ...


class ClustersFinder(Protocol):
    def find_clusters(self, mat: Matrix) -> List[RawCluster]: ...


@dataclass(frozen=True)
class PointCloud:
    dimensionalityReducer: DimensionalityReducer
    clustersFinder: ClustersFinder

    def generate(
        self,
        data: Mapping[ID, Vector],
        n_components: int = 3,
    ) -> Tuple[Dict[ID, Vector], Dict[str, Set[ID]]]:
        """
        Given a set of vectors, projects them onto lower dimensions, and
        finds clusters among the projections.

        Parameters
        ----------
        data : mapping
            Mapping of input vectors by their EventIds.

        n_components: int, default=3
            Number of dimensions in the projected space.

        Returns
        -------
        projections : dictionary
            Projected vectors in the low dimensional space, mapped back to the
            input vectors' EventIds.

        cluster_membership: dictionary
            Cluster membership by way of cluster_ids in the form of integers
            0,1,2,... mapped back to the input vectors' EventIds. Note that
            some vectors may not belong to any cluster and are excluded here.

        """

        if not data:
            return {}, {}
        event_ids, vectors = zip(*data.items())
        projections = self.dimensionalityReducer.project(
            np.stack(vectors), n_components=n_components
        )
        clusters = self.clustersFinder.find_clusters(projections)
        return dict(zip(event_ids, projections)), {
            str(i): {event_ids[row_index] for row_index in cluster}
            for i, cluster in enumerate(clusters)
        }
