import json
from typing import List, Optional, Sequence, cast

import numpy as np
import umap  # type: ignore
from numpy.typing import ArrayLike

from ..datasets import Dataset

MAX_UMAP_POINTS = 500


class Point:
    def __init__(
        self,
        x: float,
        y: float,
        z: float,
        prediction_label: str,
        # prediction_score: float,
        actual_label: str,
        # actual_score: float,
        raw_text_data: str,
        # link_to_data: str,
    ):
        self.x = x
        self.y = y
        self.z = z
        self.prediction_label = prediction_label
        # self.prediction_score = prediction_score
        self.actual_label = actual_label
        # self.actual_score = actual_score
        self.raw_text_data = raw_text_data
        # self.link_to_data = link_to_data


class PointCloud:
    def __init__(
        self,
        primary_dataset_points: List[Point],
        reference_dataset_points: List[Point],
    ):
        self.primary_dataset_points = primary_dataset_points
        self.reference_dataset_points = reference_dataset_points

    # For demo - passing to umap widget
    def to_json(self) -> str:
        primary_dataset_points_json_object = []
        for point in self.primary_dataset_points:
            point_json_obj = {
                "position": [
                    float(point.x),
                    float(point.y),
                    float(point.z),
                ]
            }
            primary_dataset_points_json_object.append(point_json_obj)
        reference_dataset_points_json_object = []
        for point in self.reference_dataset_points:
            point_json_obj = {
                "position": [
                    float(point.x),
                    float(point.y),
                    float(point.z),
                ]
            }
            reference_dataset_points_json_object.append(point_json_obj)
        data = {
            "primaryData": primary_dataset_points_json_object,
            "referenceData": reference_dataset_points_json_object,
        }
        return json.dumps(data)


def CalculateUMAP(
    primary_dataset: Dataset,
    reference_dataset: Dataset,
    embedding_feature: str,
    n_components: Optional[int] = 3,
    n_neighbors: Optional[int] = 15,
    min_dist: Optional[float] = 0.1,
) -> PointCloud:
    # Sample down our datasets to max 2500 rows for UMAP performance
    points_per_dataset = MAX_UMAP_POINTS // 2
    sampled_primary_dataset = primary_dataset.sample(
        num=MAX_UMAP_POINTS // 2,
    )
    sampled_reference_dataset = reference_dataset.sample(num=MAX_UMAP_POINTS // 2)

    primary_embeddings: np.ndarray = np.stack(
        # TODO: Perform light check on str for ArrayLike
        cast(
            Sequence[ArrayLike],
            sampled_primary_dataset.get_embedding_vector_column(embedding_feature),
        )
    )
    reference_embeddings: np.ndarray = np.stack(
        # TODO: Perform light check on str for ArrayLike
        cast(
            Sequence[ArrayLike],
            sampled_reference_dataset.get_embedding_vector_column(embedding_feature),
        )
    )

    embeddings: np.ndarray = np.concatenate([primary_embeddings, reference_embeddings])
    _umap = umap.UMAP(
        n_components=n_components,
        n_neighbors=n_neighbors,
        min_dist=min_dist,
    )
    projections: np.ndarray = _umap.fit_transform(embeddings)
    projections = move_to_center(projections)
    primary_dataset_points = construct_dataset_points(
        projections[:points_per_dataset],
        sampled_primary_dataset,
        embedding_feature,
    )
    reference_dataset_points = construct_dataset_points(
        projections[points_per_dataset:],
        sampled_reference_dataset,
        embedding_feature,
    )
    return PointCloud(
        primary_dataset_points=primary_dataset_points,
        reference_dataset_points=reference_dataset_points,
    )


def move_to_center(
    projections: np.ndarray,
) -> np.ndarray:
    # Calculate Center of Mass
    cm: np.ndarray = np.sum(projections, axis=0) / projections.shape[0]
    return projections - cm


def construct_dataset_points(
    umap_projections: np.ndarray,
    dataset: Dataset,
    embedding_feature: str,
) -> List[Point]:
    dataset_points: List[Point] = []
    for i in range(len(umap_projections)):
        dataset_point = Point(
            x=umap_projections[i][0],
            y=umap_projections[i][1],
            z=umap_projections[i][2],
            prediction_label=dataset.get_prediction_label_column()[i],
            # prediction_score=dataset.get_prediction_score_column()[i],
            actual_label=dataset.get_actual_label_column()[i],
            # actual_score=dataset.get_actual_score_column()[i],
            raw_text_data=dataset.get_embedding_raw_text_column(embedding_feature)[i],
            # link_to_data=dataset.get_embedding_link_to_data_column(embedding_feature)[i],
        )
        dataset_points.append(dataset_point)
    return dataset_points
