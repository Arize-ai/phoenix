"""
This is a description for umap
"""
import json
from typing import List, Optional

import numpy as np
from umap import UMAP

from ..datasets import Dataset

MAX_UMAP_POINTS = 500


# It creates a class called Point.
class Point:
    """
    TBD
    """

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
        """
        This function takes in a bunch of data and assigns it to the object's attributes

        :param x: float,
        :type x: float
        :param y: float,
        :type y: float
        :param z: the z-axis value of the point
        :type z: float
        :param prediction_label: The label that the model predicted for the data point
        :type prediction_label: str
        :param actual_label: The actual label of the data point
        :type actual_label: str
        :param raw_text_data: The raw text data that was used to make the prediction
        :type raw_text_data: str
        """
        self.x = x
        self.y = y
        self.z = z
        self.prediction_label = prediction_label
        # self.prediction_score = prediction_score
        self.actual_label = actual_label
        # self.actual_score = actual_score
        self.raw_text_data = raw_text_data
        # self.link_to_data = link_to_data


# A point cloud is a collection of points in 3D space.
class PointCloud:
    """
    TBD
    """

    def __init__(
        self,
        primary_dataset_points: List[Point],
        reference_dataset_points: List[Point],
    ):
        """
        > This function takes two lists of points as input and assigns them to the
        `primary_dataset_points` and
        `reference_dataset_points` attributes of the `Dataset` object.

        :param primary_dataset_points: A list of Point objects that represent the primary dataset
        :type primary_dataset_points: List[Point]
        :param reference_dataset_points: A list of points that represent the reference dataset
        :type reference_dataset_points: List[Point]
        """
        self.primary_dataset_points = primary_dataset_points
        self.reference_dataset_points = reference_dataset_points

    # For demo - passing to umap widget
    def to_json(self) -> str:
        """
        It returns a string representation of the object.
        """
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
    min_dist: Optional[int] = 0.1,
) -> PointCloud:
    """
    We take the embedding vectors from the primary and reference datasets, concatenate them,
    and then project them into 2D
    space using UMAP

    :param primary_dataset: Dataset
    :type primary_dataset: Dataset
    :param reference_dataset: The dataset that we want to compare our primary dataset to
    :type reference_dataset: Dataset
    :param embedding_feature: The name of the embedding feature to use for the UMAP calculation
    :type embedding_feature: str
    :param n_components: The number of dimensions to project the data down to, defaults to 2
    :type n_components: Optional[int] (optional)
    :param n_neighbors: The number of neighbors to use to construct the UMAP neighborhood graph,
    defaults to 15
    :type n_neighbors: Optional[int] (optional)
    :param min_dist: The effective minimum distance between embedded points. Smaller values will
    result in a more clustered/clumped embedding where nearby points on the manifold are drawn
    closer together, while larger values will result on a more even dispersal of points. The
    value should be set relative to the spread value, which determines
    :type min_dist: Optional[int]
    :return: A PointCloud object
    """
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
    umap = UMAP(
        n_components=n_components,
        n_neighbors=n_neighbors,
        min_dist=min_dist,
    )
    projections: np.ndarray = umap.fit_transform(embeddings)
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
    """
    > It takes a 3D array of projections and returns a 3D array of projections that have been
    shifted so that their center
    of mass is at the origin

    :param projections: The projections of the 3D volume
    :type projections: np.ndarray
    :return: The projections minus the center of mass.
    """
    # Calculate Center of Mass
    cm: np.ndarray = np.sum(projections, axis=0) / projections.shape[0]
    return projections - cm


def construct_dataset_points(
    umap_projections: np.ndarray,
    dataset: Dataset,
    embedding_feature: str,
) -> List[Point]:
    """
    > This function takes in a UMAP projection, a dataset, and an embedding feature, and returns
    a list of points

    :param umap_projections: np.ndarray
    :type umap_projections: np.ndarray
    :param dataset: The dataset object that contains the embedding data
    :type dataset: Dataset
    :param embedding_feature: The name of the embedding feature you want to use
    :type embedding_feature: str
    :return: A list of points.
    """
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
            raw_text_data=dataset.get_embedding_raw_text_column(embedding_feature),
            # link_to_data=dataset.get_embedding_link_to_data_column(embedding_feature),
        )
        dataset_points.append(dataset_point)
    return dataset_points
