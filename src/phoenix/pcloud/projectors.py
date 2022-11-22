from dataclasses import dataclass
from typing import Dict, List, Union

import numpy as np
from hdbscan import HDBSCAN
from umap import UMAP

from ..datasets import Dataset
from .pcloud import Point

MAX_UMAP_POINTS = 500


@dataclass(frozen=True)
class UMAPProjector:
    hyperparameters: Dict[str, Union[int, float, str]]

    def __post__init__(self):
        if "n_neighbors" in self.hyperparameters and self.hyperparameters["n_neighbors"] > 3:
            raise ValueError("Proction dimensionality not supported. Must be 2D or 3D.")

    def _fit_transform(self, X):
        return UMAP(**self.hyperparameters).fit_transform(X)

    @staticmethod
    def _move_to_center(
        projections: np.ndarray,
    ) -> np.ndarray:
        # Calculate Center of Mass
        cm: np.ndarray = np.sum(projections, axis=0) / projections.shape[0]
        return projections - cm

    @staticmethod
    def _construct_dataset_points(
        projections: np.ndarray,
        cluster_ids: np.ndarray,
        dataset: Dataset,
        embedding_feature: str,
    ) -> List[Point]:
        dataset_points: List[Point] = []
        for i in range(len(projections)):
            dataset_point = Point(
                x=projections[i][0],
                y=projections[i][1],
                z=projections[i][2],
                cluster_id=cluster_ids[i],
                prediction_label=dataset.get_prediction_label_column()[i],
                # prediction_score=dataset.get_prediction_score_column()[i],
                actual_label=dataset.get_actual_label_column()[i],
                # actual_score=dataset.get_actual_score_column()[i],
                raw_text_data=dataset.get_embedding_raw_text_column(embedding_feature),
                # link_to_data=dataset.get_embedding_link_to_data_column(embedding_feature),
            )
            dataset_points.append(dataset_point)
        return dataset_points

    def project(self, primary_dataset: Dataset, reference_dataset: Dataset, embedding_feature: str):
        # Sample down our datasets to max 2500 rows for UMAP performance
        points_per_dataset = MAX_UMAP_POINTS // 2
        sampled_primary_dataset = primary_dataset.sample(
            num=MAX_UMAP_POINTS // 2,
        )
        sampled_reference_dataset = reference_dataset.sample(num=MAX_UMAP_POINTS // 2)

        primary_embeddings: np.ndarray = np.stack(
            sampled_primary_dataset.get_embedding_vector_column(embedding_feature)
        )
        reference_embeddings: np.ndarray = np.stack(
            sampled_reference_dataset.get_embedding_vector_column(embedding_feature)
        )

        embeddings: np.ndarray = np.concatenate([primary_embeddings, reference_embeddings])
        projections: np.ndarray = self._fit_transform(embeddings)
        projections = self._move_to_center(projections)
        # Find clusters
        hdbscan = HDBSCAN(min_cluster_size=20, min_samples=1)
        cluster_ids = hdbscan.fit_predict(projections)

        primary_dataset_points = self._construct_dataset_points(
            projections[:points_per_dataset],
            cluster_ids[:points_per_dataset],
            sampled_primary_dataset,
            embedding_feature,
        )
        reference_dataset_points = self._construct_dataset_points(
            projections[points_per_dataset:],
            cluster_ids[points_per_dataset:],
            sampled_reference_dataset,
            embedding_feature,
        )

        return primary_dataset_points, reference_dataset_points
