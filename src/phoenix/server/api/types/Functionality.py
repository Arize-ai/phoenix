import strawberry


@strawberry.type
class Functionality:
    """
    Describes the the functionality of the platform that is enabled
    """

    model_inferences: bool = strawberry.field(
        description="Model inferences are available for analysis"
    )
    tracing: bool = strawberry.field(
        description="Generative tracing records are available for analysis"
    )
