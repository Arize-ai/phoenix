from dataclasses import asdict, dataclass

import numpy as np
import numpy.typing as npt
from typing_extensions import TypeAlias

RowIndex: TypeAlias = int
RawCluster: TypeAlias = set[RowIndex]
Matrix: TypeAlias = npt.NDArray[np.float64]


@dataclass(frozen=True)
class Hdbscan:
    min_cluster_size: int = 10
    min_samples: float = 1
    cluster_selection_epsilon: float = 0.0

    def find_clusters(self, mat: Matrix) -> list[RawCluster]:
        from fast_hdbscan import HDBSCAN

        cluster_ids: npt.NDArray[np.int_] = HDBSCAN(**asdict(self)).fit_predict(mat)
        ans: list[RawCluster] = [set() for _ in range(np.max(cluster_ids) + 1)]
        for row_idx, cluster_id in enumerate(cluster_ids):
            if cluster_id > -1:
                ans[cluster_id].add(row_idx)
        return ans
