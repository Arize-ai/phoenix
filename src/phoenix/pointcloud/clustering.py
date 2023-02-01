from dataclasses import asdict, dataclass
from typing import List, Set

import numpy as np
import numpy.typing as npt
from hdbscan import HDBSCAN

DEFAULT_MIN_CLUSTER_SIZE = 20
DEFAULT_MIN_SAMPLES = 1


@dataclass(frozen=True)
class Parameters:
    min_cluster_size: int = DEFAULT_MIN_CLUSTER_SIZE
    min_samples: float = DEFAULT_MIN_SAMPLES


@dataclass(frozen=True)
class Hdbscan:
    parameters: Parameters

    def find_clusters(self, arr: npt.NDArray[np.float64]) -> List[Set[int]]:
        cluster_ids: npt.NDArray[np.int_] = HDBSCAN(**asdict(self.parameters)).fit_predict(arr)
        ans: List[Set[int]] = [set() for _ in range(np.max(cluster_ids) + 1)]
        for i, cluster_id in enumerate(cluster_ids):
            if cluster_id > -1:
                ans[cluster_id].add(i)
        return ans
