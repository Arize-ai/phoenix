from dataclasses import dataclass

from .clustering import Hdbscan
from .clustering import Parameters as HdbscanParamaters
from .pointcloud import PointCloud
from .projectors import Parameters as UmapParamaters
from .projectors import Umap

MAX_UMAP_POINTS = 500
DEFAULT_MIN_CLUSTER_SIZE = 20
DEFAULT_MIN_SAMPLES = 1


@dataclass(frozen=True)
class UmapPointCloud(PointCloud):
    umap_param: UmapParamaters
    hdbscan_param: HdbscanParamaters

    def __post_init__(self) -> None:
        super().__init__(
            dimensionalityReducer=Umap(self.umap_param), clustersFinder=Hdbscan(self.hdbscan_param)
        )

    # TODO: extract embedding tensor and metadata from dataset, filtered and sampled
    # TODO: return points to the caller, depending on the gql interface
