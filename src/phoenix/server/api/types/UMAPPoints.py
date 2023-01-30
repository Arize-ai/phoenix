from typing import List, Union

import strawberry


@strawberry.type
class ThreeDimensionalPoint:
    x: float
    y: float
    z: float


class TwoDimensionalPoint:
    x: float
    y: float


@strawberry.type
class UMAPPointsData:
    """points and meta data for a UMAP plot"""

    coordinates: List[Union[ThreeDimensionalPoint, TwoDimensionalPoint]]


@strawberry.type
class UMAPPoints:
    data: UMAPPointsData
