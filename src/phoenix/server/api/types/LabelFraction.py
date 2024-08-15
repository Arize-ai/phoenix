import strawberry


@strawberry.type
class LabelFraction:
    label: str
    fraction: float
