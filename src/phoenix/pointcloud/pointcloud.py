import json
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, List

MAX_UMAP_POINTS = 500


class Coordinates(ABC):
    @abstractmethod
    def get_coordinates(self):
        pass


@dataclass
class Coordinates2D(Coordinates):
    x: float
    y: float

    def get_coordinates(self):
        return [float(self.x), float(self.y)]


@dataclass
class Coordinates3D(Coordinates):
    x: float
    y: float
    z: float

    def get_coordinates(self):
        return [float(self.x), float(self.y), float(self.z)]


@dataclass(frozen=True)
class Point:
    id: int
    coordinates: Coordinates
    prediction_label: str
    # prediction_score: float,
    actual_label: str
    # actual_score: float,
    raw_text_data: str
    # link_to_data: str,


@dataclass(frozen=True)
class Cluster:
    id: int
    point_ids: List[int]
    purity_score: float


@dataclass(frozen=True)
class DriftPointCloud:
    primary_points: List[Point]
    reference_points: List[Point]
    clusters: List[Cluster]

    # For demo - passing to umap widget
    def to_json(self) -> str:
        primary_pts_json = self._points_to_json(self.primary_points)
        reference_pts_json = self._points_to_json(self.reference_points)
        clusters_json = self._clusters_to_json(self.clusters)

        data = {
            "primaryData": primary_pts_json,
            "referenceData": reference_pts_json,
            "clusters": clusters_json,
        }
        return json.dumps(data)

    @staticmethod
    def _points_to_json(points: List[Point]) -> List[Dict[str, Any]]:
        pts_json = []
        for point in points:
            point_json_obj = {
                "position": point.coordinates.get_coordinates(),
                "metaData": {
                    "id": int(point.id),
                    "rawTextData": [point.raw_text_data],
                    "predictionLabel": point.prediction_label,
                    "actualLabel": point.actual_label,
                }
            }
            pts_json.append(point_json_obj)
        return pts_json

    @staticmethod
    def _clusters_to_json(clusters: List[Cluster]) -> List[Dict[str, Any]]:
        clusters_json = []
        for cluster in clusters:
            cluster_json_obj = {
                "id": int(cluster.id),
                "pointIds": cluster.point_ids,
                "purityScore": cluster.purity_score,
            }
            clusters_json.append(cluster_json_obj)
        return clusters_json
