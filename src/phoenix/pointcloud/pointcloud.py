from dataclasses import dataclass
from typing import Hashable, Mapping, Protocol, Set, TypeVar

import numpy as np
import numpy.typing as npt

Identifier = TypeVar("Identifier", bound=Hashable)


class DimensionalityReducer(Protocol):
    def project(self, arr: npt.NDArray[np.float64], n_components: int) -> npt.NDArray[np.float64]:
        ...


class ClustersFinder(Protocol):
    def find_clusters(self, arr: npt.NDArray[np.float64]) -> list[Set[int]]:
        ...


@dataclass(frozen=True)
class PointCloud:
    dimensionalityReducer: DimensionalityReducer
    clustersFinder: ClustersFinder

    def generate(
        self,
        vectors: Mapping[Identifier, npt.NDArray[np.float64]],
        n_components: int,
    ) -> tuple[dict[Identifier, npt.NDArray[np.float64]], list[Set[Identifier]]]:
        ids, vs = zip(*vectors.items())
        projections = self.dimensionalityReducer.project(np.stack(vs), n_components=n_components)
        return dict(zip(ids, projections)), [
            set(ids[i] for i in c) for c in self.clustersFinder.find_clusters(projections)
        ]
