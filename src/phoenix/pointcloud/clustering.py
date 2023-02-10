from dataclasses import asdict, dataclass
from typing import List, Set

import numpy as np
import numpy.typing as npt
from hdbscan import HDBSCAN
from typing_extensions import TypeAlias

RowIndex: TypeAlias = int
Cluster: TypeAlias = Set[RowIndex]
Matrix: TypeAlias = npt.NDArray[np.float64]


@dataclass(frozen=True)
class Hdbscan:
    min_cluster_size: int = 20
    min_samples: float = 1

    def find_clusters(self, mat: Matrix) -> List[Cluster]:
        cluster_ids: npt.NDArray[np.int_] = HDBSCAN(**asdict(self)).fit_predict(mat)
        ans: List[Cluster] = [set() for _ in range(np.max(cluster_ids) + 1)]
        for row_idx, cluster_id in enumerate(cluster_ids):
            if cluster_id > -1:
                ans[cluster_id].add(row_idx)
        return ans
