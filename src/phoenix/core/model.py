from typing import List, Optional, Union

from phoenix.datasets.dataset import Dataset
from phoenix.datasets.schema import EmbeddingColumnNames, EmbeddingFeatures

from .embedding_dimension import EmbeddingDimension


def _get_embedding_dimensions(
    primary_dataset: Dataset, reference_dataset: Optional[Dataset]
) -> List[EmbeddingDimension]:
    embedding_dimensions: List[EmbeddingDimension] = []
    embedding_features: EmbeddingFeatures = {}

    primary_embedding_features: Optional[EmbeddingFeatures] = (
        primary_dataset.schema.embedding_feature_column_names
    )
    if primary_embedding_features is not None:
        embedding_features.update(primary_embedding_features)
    primary_prompt_column_names: Optional[EmbeddingColumnNames] = (
        primary_dataset.schema.prompt_column_names
    )
    if primary_prompt_column_names is not None:
        embedding_features.update({"prompt": primary_prompt_column_names})
    primary_response_column_names: Optional[Union[str, EmbeddingColumnNames]] = (
        primary_dataset.schema.response_column_names
    )
    if isinstance(primary_response_column_names, EmbeddingColumnNames):
        embedding_features.update({"response": primary_response_column_names})

    if reference_dataset is not None:
        reference_embedding_features: Optional[EmbeddingFeatures] = (
            reference_dataset.schema.embedding_feature_column_names
        )
        if reference_embedding_features is not None:
            embedding_features.update(reference_embedding_features)
        reference_prompt_column_names: Optional[EmbeddingColumnNames] = (
            reference_dataset.schema.prompt_column_names
        )
        if reference_prompt_column_names is not None:
            embedding_features.update({"prompt": reference_prompt_column_names})
        reference_response_column_names: Optional[Union[str, EmbeddingColumnNames]] = (
            reference_dataset.schema.response_column_names
        )
        if isinstance(reference_response_column_names, EmbeddingColumnNames):
            embedding_features.update({"response": reference_response_column_names})

    for embedding_feature, embedding_column_names in embedding_features.items():
        embedding_dimensions.append(EmbeddingDimension(name=embedding_feature))
        if reference_dataset is not None:
            _check_embedding_vector_lengths_match_across_datasets(
                embedding_feature, embedding_column_names, primary_dataset, reference_dataset
            )

    return embedding_dimensions


def _check_embedding_vector_lengths_match_across_datasets(
    embedding_feature_name: str,
    embedding_column_names: EmbeddingColumnNames,
    primary_dataset: Dataset,
    reference_dataset: Dataset,
) -> None:
    """
    Ensure that for each embedding feature, the vector lengths match across the primary
    and reference datasets which is required for calculating embedding drift (vector distance)
    """
    primary_vector_length = _get_column_vector_length(
        primary_dataset, embedding_column_names.vector_column_name
    )
    reference_vector_length = _get_column_vector_length(
        reference_dataset, embedding_column_names.vector_column_name
    )

    # if one of the datasets doesn't have the embedding column at all, which is fine since we
    # just consider this as missing from one of the datasets and won't need to worry about
    # calculating drift
    if primary_vector_length is None or reference_vector_length is None:
        return

    if primary_vector_length != reference_vector_length:
        raise ValueError(
            f"Embedding vector length must match for "
            f"both datasets; embedding_feature={embedding_feature_name} "
            f"vector_column={embedding_column_names.vector_column_name}"
        )


def _get_column_vector_length(dataset: Dataset, embedding_vector_column_name: str) -> Optional[int]:
    """
    Because a dataset has already been constructed, we can assume that the lengths
    of the vectors for any given embedding feature in the dataset are the same.
    Returns the length a vector by getting the length first non-null vector.
    """
    if embedding_vector_column_name not in dataset.dataframe:
        return None

    column = dataset.dataframe[embedding_vector_column_name]

    for row in column:
        # None/NaN is a valid entry for a row and represents the fact that the
        # embedding feature is missing/empty. Skip until a row is found with a
        # non-empty vector. Check the presence of dunder method __len__ to skip
        # scalar values, e.g. None/NaN.
        if not hasattr(row, "__len__"):
            continue
        return len(row)

    return None
