from dataclasses import dataclass

DEFAULT_MIN_DIST = 0.0
DEFAULT_N_NEIGHBORS = 30
DEFAULT_N_SAMPLES = 500

MIN_NEIGHBORS = 5
MAX_NEIGHBORS = 100
MIN_SAMPLES = 1
MAX_SAMPLES = 1000
MIN_MIN_DIST = 0.0
MAX_MIN_DIST = 0.99


def get_umap_parameters(default_umap_parameters):
    return UMAPParameters(
        min_dist=default_umap_parameters.get("minDist", DEFAULT_MIN_DIST),
        n_neighbors=default_umap_parameters.get("nNeighbors", DEFAULT_N_NEIGHBORS),
        n_samples=default_umap_parameters.get("nSamples", DEFAULT_N_SAMPLES),
    )


@dataclass
class UMAPParameters:
    """
    Can include any of the three keys: "minDist", "nNeighbors", "nSamples" necessary for point cloud initialization
    """

    min_dist: float
    n_neighbors: int
    n_samples: int

    def __post_init__(self):
        if not isinstance(self.min_dist, float) or not (
            MIN_MIN_DIST <= self.min_dist <= MAX_MIN_DIST
        ):
            raise ValueError(
                f"minDist should be of type float and must be between {MIN_MIN_DIST} and {MAX_MIN_DIST}"
            )

        if not isinstance(self.n_neighbors, int) or not (
            MIN_NEIGHBORS <= self.n_neighbors <= MAX_NEIGHBORS
        ):
            raise ValueError(
                f"nNeighbors should be of type int and must be between {MIN_NEIGHBORS} and {MAX_NEIGHBORS}"
            )

        if not isinstance(self.n_samples, int) or not (
            MIN_SAMPLES <= self.n_samples <= MAX_SAMPLES
        ):
            raise ValueError(
                f"nSamples should be of type int and must be between {MIN_SAMPLES} and {MAX_SAMPLES}"
            )
