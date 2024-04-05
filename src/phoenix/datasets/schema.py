from phoenix.inferences.schema import (
    EmbeddingColumnNames as _EmbeddingColumnNames,
)
from phoenix.inferences.schema import (
    RetrievalEmbeddingColumnNames as _RetrievalEmbeddingColumnNames,
)
from phoenix.inferences.schema import (
    Schema as _Schema,
)
from phoenix.utilities.deprecation import deprecated_class


@deprecated_class(
    "The phoenix.datasets.fixtures module is deprecated, use phoenix.inferences.fixtures instead."
)
class EmbeddingColumnNames(_EmbeddingColumnNames):
    pass


@deprecated_class(
    "The phoenix.datasets.fixtures module is deprecated, use phoenix.inferences.fixtures instead."
)
class RetrievalEmbeddingColumnNames(_RetrievalEmbeddingColumnNames):
    pass


@deprecated_class(
    "The phoenix.datasets.fixtures module is deprecated, use phoenix.inferences.fixtures instead."
)
class Schema(_Schema):
    pass
