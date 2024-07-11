from dataclasses import dataclass
from typing import Any, Mapping, Optional

DEFAULT_MIN_DIST = 0.0
DEFAULT_N_NEIGHBORS = 30
DEFAULT_N_SAMPLES = 500

MIN_NEIGHBORS = 5
MAX_NEIGHBORS = 100
MIN_SAMPLES = 1
MAX_SAMPLES = 1000
MIN_MIN_DIST = 0.0
MAX_MIN_DIST = 0.99


@dataclass
class UMAPParameters:
    min_dist: float = DEFAULT_MIN_DIST
    n_neighbors: int = DEFAULT_N_NEIGHBORS
    n_samples: int = DEFAULT_N_SAMPLES

    def __post_init__(self) -> None:
        if not isinstance(self.min_dist, float) or not (
            MIN_MIN_DIST <= self.min_dist <= MAX_MIN_DIST
        ):
            raise ValueError(
                f"minDist must be float type, and between {MIN_MIN_DIST} and {MAX_MIN_DIST}"
            )

        if not isinstance(self.n_neighbors, int) or not (
            MIN_NEIGHBORS <= self.n_neighbors <= MAX_NEIGHBORS
        ):
            raise ValueError(
                f"nNeighbors must be int type, and between {MIN_NEIGHBORS} and {MAX_NEIGHBORS}"
            )

        if not isinstance(self.n_samples, int) or not (
            MIN_SAMPLES <= self.n_samples <= MAX_SAMPLES
        ):
            raise ValueError(
                f"nSamples must be int type, and between {MIN_SAMPLES} and {MAX_SAMPLES}"
            )


def get_umap_parameters(default_umap_parameters: Optional[Mapping[str, Any]]) -> UMAPParameters:
    if not default_umap_parameters:
        return UMAPParameters()
    return UMAPParameters(
        min_dist=float(default_umap_parameters.get("min_dist", DEFAULT_MIN_DIST)),
        n_neighbors=int(default_umap_parameters.get("n_neighbors", DEFAULT_N_NEIGHBORS)),
        n_samples=int(default_umap_parameters.get("n_samples", DEFAULT_N_SAMPLES)),
    )
