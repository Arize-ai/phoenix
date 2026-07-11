from typing import Annotated, Union

import strawberry
from typing_extensions import TypeAlias

from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.Experiment import Experiment
from phoenix.server.api.types.Project import Project
from phoenix.server.api.types.Prompt import Prompt

SearchResult: TypeAlias = Annotated[
    Union[Project, Dataset, Experiment, Prompt],
    strawberry.union(
        "SearchResult",
        description=(
            "An entity returned by global search. One of the searchable "
            "resource types: Project, Dataset, Experiment, or Prompt."
        ),
    ),
]
