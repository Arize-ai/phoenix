import strawberry


@strawberry.input
class InputCoordinate3D:
    x: float
    y: float
    z: float


@strawberry.input
class InputCoordinate2D:
    x: float
    y: float
