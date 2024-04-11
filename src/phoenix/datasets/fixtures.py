from phoenix.inferences.fixtures import (
    ExampleInferences as _ExampleInferences,
)
from phoenix.inferences.fixtures import (
    load_example as _load_example,
)
from phoenix.utilities.deprecation import deprecated, deprecated_class


@deprecated_class(
    (
        "The phoenix.datasets.fixtures.ExampleDatasets is deprecated, "
        "use phoenix.inferences.fixtures.ExampleInferences instead."
    )
)
class ExampleDatasets(_ExampleInferences):
    pass


@deprecated(
    "The phoenix.datasets.fixtures module is deprecated, use phoenix.inferences.fixtures instead."
)
def load_example(use_case: str) -> None:
    _load_example(use_case)
