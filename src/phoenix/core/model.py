from typing import BinaryIO, Dict, Iterable, List, Mapping, Optional, cast

import numpy.typing as npt
import pandas as pd
from pandas.api.types import is_numeric_dtype, is_object_dtype

from phoenix.datasets import Dataset
from phoenix.datasets.schema import EmbeddingColumnNames, EmbeddingFeatures

from ..datasets.dataset import DatasetRole
from .dimension import Dimension
from .dimension_data_type import DimensionDataType
from .dimension_type import DimensionType
from .embedding_dimension import EmbeddingDimension


class Model:
    def __init__(self, primary_dataset: Dataset, reference_dataset: Optional[Dataset] = None):
        self.__primary_dataset = primary_dataset
        self.__reference_dataset = reference_dataset
        self.__dimensions = self._get_dimensions(self.primary_dataset, self.reference_dataset)
        self.__embedding_dimensions: List[EmbeddingDimension] = _get_embedding_dimensions(
            self.primary_dataset, self.reference_dataset
        )
        self.__datasets = {
            DatasetRole.PRIMARY: primary_dataset,
            DatasetRole.REFERENCE: reference_dataset,
        }

    @property
    def primary_dataset(self) -> Dataset:
        return self.__primary_dataset

    @property
    def reference_dataset(self) -> Optional[Dataset]:
        return self.__reference_dataset

    @property
    def dimensions(self) -> List[Dimension]:
        return self.__dimensions

    @property
    def embedding_dimensions(self) -> List[EmbeddingDimension]:
        return self.__embedding_dimensions

    def _get_dimensions(
        self, primary_dataset: Dataset, reference_dataset: Optional[Dataset]
    ) -> List[Dimension]:
        # TODO: include reference dataset dimensions
        dimensions: List[Dimension] = []
        schema = primary_dataset.schema

        actual_column_names = [
            name
            for name in [
                schema.actual_label_column_name,
                schema.actual_score_column_name,
            ]
            if name is not None
        ]
        prediction_column_names = [
            name
            for name in [
                schema.prediction_label_column_name,
                schema.prediction_score_column_name,
            ]
            if name is not None
        ]
        feature_column_names = (
            schema.feature_column_names if schema.feature_column_names is not None else []
        )
        tag_column_names = schema.tag_column_names if schema.tag_column_names is not None else []
        dimension_type_to_column_names: Dict[DimensionType, List[str]] = {
            DimensionType.ACTUAL: actual_column_names,
            DimensionType.PREDICTION: prediction_column_names,
            DimensionType.FEATURE: feature_column_names,
            DimensionType.TAG: tag_column_names,
        }

        for dimension_type, column_names in dimension_type_to_column_names.items():
            for name in column_names:
                dimensions.append(
                    Dimension(
                        name=name,
                        data_type=self._infer_dimension_data_type(name),
                        type=dimension_type,
                        data=(
                            lambda name: (
                                lambda: (
                                    [primary_dataset.dataframe.loc[:, name]]
                                    + (
                                        [reference_dataset.dataframe.loc[:, name]]
                                        if reference_dataset is not None
                                        else []
                                    )
                                )
                            )
                        )(name),
                    )
                )

        return dimensions

    def _infer_dimension_data_type(self, dimension_name: str) -> DimensionDataType:
        # TODO: verify corresponding dimension of reference dataset has same type
        dimension_pandas_dtype = cast(
            npt.DTypeLike, self.primary_dataset.dataframe[dimension_name].dtype
        )
        if is_numeric_dtype(dimension_pandas_dtype):
            return DimensionDataType.NUMERIC
        elif is_object_dtype(dimension_pandas_dtype):
            return DimensionDataType.CATEGORICAL
        raise ValueError("Unrecognized dimension type")

    def export_events_as_parquet_file(
        self,
        rows: Mapping[DatasetRole, Iterable[int]],
        parquet_file: BinaryIO,
    ) -> None:
        """
        Given row numbers, exports dataframe subset into parquet file.
        Duplicate rows are removed.

        Parameters
        ----------
        rows: Mapping[DatasetRole, Iterable[int]]
            mapping of dataset type to list of row numbers
        parquet_file: file handle
            output parquet file handle
        """
        pd.concat(
            dataset.get_events(rows.get(dataset_role, ()))
            for dataset_role, dataset in self.__datasets.items()
            if dataset is not None
        ).to_parquet(parquet_file, index=False)


def _get_embedding_dimensions(
    primary_dataset: Dataset, reference_dataset: Optional[Dataset]
) -> List[EmbeddingDimension]:
    embedding_dimensions: List[EmbeddingDimension] = []
    embedding_features: Dict[str, EmbeddingColumnNames] = {}

    primary_embedding_features: Optional[
        EmbeddingFeatures
    ] = primary_dataset.schema.embedding_feature_column_names

    if primary_embedding_features is not None:
        embedding_features.update(primary_embedding_features)
    if reference_dataset is not None:
        reference_embedding_features: Optional[
            Dict[str, EmbeddingColumnNames]
        ] = reference_dataset.schema.embedding_feature_column_names
        if reference_embedding_features is not None:
            embedding_features.update(reference_embedding_features)

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
        # None is a valid entry for a row and represents the fact that the embedding feature
        # is missing/empty. Skip until a row is found with a non-empty vector
        if row is None:
            continue
        return len(row)

    return None
