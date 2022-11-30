from dataclasses import dataclass
from typing import Dict, List, Sequence, Tuple, Type, Union, cast

import numpy as np
from hdbscan import HDBSCAN  # type: ignore
from numpy.typing import ArrayLike
from umap import UMAP  # type: ignore

from ..datasets import Dataset
from .pointcloud import Cluster, Coordinates, Coordinates2D, Coordinates3D, Point

MAX_UMAP_POINTS = 500
DEFAULT_MIN_CLUSTER_SIZE = 20
DEFAULT_MIN_SAMPLES = 1


@dataclass(frozen=True)
class UMAPProjector:
    hyperparameters: Dict[str, Union[int, float, str]]

    def __post__init__(self):
        if "n_neighbors" in self.hyperparameters and (
            not isinstance(self.hyperparameters["n_neighbors"], int)
            or self.hyperparameters["n_neighbors"] not in (2, 3)
        ):
            raise ValueError(
                "Projection dimensionality not supported. Must be integer value: 2 or 3 (2D/3D)."
            )

    @staticmethod
    def _move_to_center(projections: np.ndarray) -> np.ndarray:
        # Calculate Center of Mass
        cm: np.ndarray = np.sum(projections, axis=0) / projections.shape[0]
        return projections - cm

    @staticmethod
    def _build_points(
        primary_projections: np.ndarray,
        reference_projections: np.ndarray,
        primary_dataset: Dataset,
        reference_dataset: Dataset,
        embedding_feature: str,
    ) -> Tuple[List[Point], List[Point]]:
        primary_points: List[Point] = []
        reference_points: List[Point] = []

        # Number of dimensions in projections: 2D or 3D
        N = primary_projections.shape[-1]
        c: Type[Coordinates]
        if N == 2:
            c = Coordinates2D
        elif N == 3:
            c = Coordinates3D
        else:
            raise ValueError("Projections should be done to 2D or 3D.")

        for i in range(len(primary_projections)):
            primary_points.append(
                Point(
                    id=i,
                    coordinates=c(*[primary_projections[i][k] for k in range(N)]),
                    prediction_label=primary_dataset.get_prediction_label_column()[i],
                    actual_label=primary_dataset.get_actual_label_column()[i],
                    raw_text_data=primary_dataset.get_embedding_raw_data_column(embedding_feature)[
                        i
                    ],
                )
            )
        for i in range(len(reference_projections)):
            reference_points.append(
                Point(
                    id=i + len(primary_projections),
                    coordinates=c(*[reference_projections[i][k] for k in range(N)]),
                    prediction_label=reference_dataset.get_prediction_label_column()[i],
                    actual_label=reference_dataset.get_actual_label_column()[i],
                    raw_text_data=reference_dataset.get_embedding_raw_data_column(
                        embedding_feature
                    )[i],
                )
            )
        return primary_points, reference_points

    @staticmethod
    def _build_clusters(
        cluster_ids: np.ndarray, primary_points: List[Point], reference_points: List[Point]
    ):
        unique_cluster_ids: np.ndarray = np.unique(cluster_ids)
        # map cluster_id to point_ids inside the cluster
        map_cluster_id_point_ids: Dict[int, List[int]] = {
            id: [] for id in unique_cluster_ids if id != -1
        }
        # map cluster_id to the count of primary points in the cluster
        map_cluster_id_primary_count: Dict[int, int] = {
            id: 0 for id in unique_cluster_ids if id != -1
        }
        # map cluster_id to the count of reference points in the cluster
        map_cluster_id_reference_count: Dict[int, int] = {
            id: 0 for id in unique_cluster_ids if id != -1
        }

        primary_cluster_ids = cluster_ids[: len(primary_points)]
        reference_cluster_ids = cluster_ids[len(primary_points) :]
        # Check that there are as many coordinates as cluster IDs
        # This is a defensive test, since this should be guaranteed by UMAP & HDBSCAN libraries
        if len(reference_cluster_ids) != len(reference_points):
            raise ValueError(
                f"There should be equal number of point coordinates as cluster IDs. "
                f"len(reference_cluster_ids) = {len(reference_cluster_ids)}. "
                f"len(reference_points) = {len(reference_points)}."
            )

        for i, cluster_id in enumerate(primary_cluster_ids):
            if cluster_id == -1:  # Exclude "unknown" cluster
                continue
            map_cluster_id_point_ids[cluster_id].append(primary_points[i].id)
            map_cluster_id_primary_count[cluster_id] += 1
        for i, cluster_id in enumerate(reference_cluster_ids):

            if cluster_id == -1:  # Exclude "unknown" cluster
                continue
            map_cluster_id_point_ids[cluster_id].append(reference_points[i].id)
            map_cluster_id_reference_count[cluster_id] += 1

        clusters: List[Cluster] = []
        for cluster_id, point_ids in map_cluster_id_point_ids.items():
            primary_count = map_cluster_id_primary_count[cluster_id]
            reference_count = map_cluster_id_reference_count[cluster_id]
            purity_score = (reference_count - primary_count) / (reference_count + primary_count)
            clusters.append(Cluster(id=cluster_id, point_ids=point_ids, purity_score=purity_score))
        return clusters

    def project(self, primary_dataset: Dataset, reference_dataset: Dataset, embedding_feature: str):
        # Sample down our datasets to max 2500 rows for UMAP performance
        points_per_dataset = MAX_UMAP_POINTS // 2
        sampled_primary_dataset = primary_dataset.sample(num=points_per_dataset)
        sampled_reference_dataset = reference_dataset.sample(num=MAX_UMAP_POINTS // 2)

        primary_embeddings: np.ndarray = np.stack(
            cast(
                Sequence[ArrayLike],
                sampled_primary_dataset.get_embedding_vector_column(embedding_feature),
            )
        )
        reference_embeddings: np.ndarray = np.stack(
            cast(
                Sequence[ArrayLike],
                sampled_reference_dataset.get_embedding_vector_column(embedding_feature),
            )
        )

        embeddings: np.ndarray = np.concatenate([primary_embeddings, reference_embeddings])
        umap = UMAP(**self.hyperparameters)
        projections: np.ndarray = umap.fit_transform(embeddings)  # type: ignore
        projections = self._move_to_center(projections)
        # Find clusters
        hdbscan = HDBSCAN(
            min_cluster_size=DEFAULT_MIN_CLUSTER_SIZE, min_samples=DEFAULT_MIN_SAMPLES
        )
        cluster_ids: np.ndarray = hdbscan.fit_predict(projections)

        primary_points, reference_points = self._build_points(
            projections[:points_per_dataset],
            projections[points_per_dataset:],
            sampled_primary_dataset,
            sampled_reference_dataset,
            embedding_feature,
        )

        clusters = self._build_clusters(cluster_ids, primary_points, reference_points)

        return primary_points, reference_points, clusters
