import json
from typing import List

MAX_UMAP_POINTS = 500


class Point:
    def __init__(
        self,
        x: float,
        y: float,
        z: float,
        cluster_id: int,
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
        self.cluster_id = cluster_id
        self.prediction_label = prediction_label
        # self.prediction_score = prediction_score
        self.actual_label = actual_label
        # self.actual_score = actual_score
        self.raw_text_data = raw_text_data
        # self.link_to_data = link_to_data


class PointCloud:
    def __init__(
        self,
        primary_points: List[Point],
        reference_points: List[Point],
    ):
        self.primary_points = primary_points
        self.reference_points = reference_points

    # For demo - passing to umap widget
    def to_json(self) -> str:
        primary_dataset_points_json_object = []
        for point in self.primary_points:
            point_json_obj = {
                "position": [
                    float(point.x),
                    float(point.y),
                    float(point.z),
                ],
                "clusterId": float(point.cluster_id),
            }
            primary_dataset_points_json_object.append(point_json_obj)
        reference_dataset_points_json_object = []
        for point in self.reference_points:
            point_json_obj = {
                "position": [
                    float(point.x),
                    float(point.y),
                    float(point.z),
                ],
                "clusterId": float(point.cluster_id),
            }
            reference_dataset_points_json_object.append(point_json_obj)
        data = {
            "primaryData": primary_dataset_points_json_object,
            "referenceData": reference_dataset_points_json_object,
        }
        return json.dumps(data)
