from enum import Enum

import strawberry


@strawberry.enum(description="What writes a project's traces.")
class ProjectKind(Enum):
    STANDARD = strawberry.enum_value(
        "STANDARD",
        description="A project that holds traces sent by an application.",
    )
    PLAYGROUND = strawberry.enum_value(
        "PLAYGROUND",
        description="The project that holds traces from the prompt playground.",
    )
    EXPERIMENT = strawberry.enum_value(
        "EXPERIMENT",
        description="A project that holds the traces of an experiment's runs.",
    )
    EVALUATOR = strawberry.enum_value(
        "EVALUATOR",
        description="A project that holds the traces of a dataset or project evaluator.",
    )
