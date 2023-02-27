from typing import Dict, List, Optional

from pandas.api.types import is_numeric_dtype, is_object_dtype

from phoenix.datasets import Dataset
from phoenix.datasets.schema import EmbeddingFeatures

from .dimension import Dimension
from .dimension_data_type import DimensionDataType
from .dimension_type import DimensionType
from .embedding_dimension import EmbeddingDimension


class Model:
    def __init__(self, primary_dataset: Dataset, reference_dataset: Optional[Dataset] = None):
        self.__primary_dataset = primary_dataset
        self.__reference_dataset = reference_dataset
        self.__dimensions = self._get_dimensions(self.primary_dataset, self.reference_dataset)
        self.__embedding_dimensions: List[EmbeddingDimension] = self._get_embedding_dimensions(
            self.primary_dataset, self.reference_dataset
        )

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

    @staticmethod
    def _get_embedding_dimensions(
        primary_dataset: Dataset, reference_dataset: Optional[Dataset]
    ) -> List[EmbeddingDimension]:
        # TODO: Include reference dataset embedding dimensions
        embedding_dimensions = []
        embedding_features: Optional[
            EmbeddingFeatures
        ] = primary_dataset.schema.embedding_feature_column_names
        if embedding_features is not None:
            for embedding_feature_name in embedding_features:
                embedding_dimensions.append(EmbeddingDimension(name=embedding_feature_name))
        return embedding_dimensions

    def _infer_dimension_data_type(self, dimension_name: str) -> DimensionDataType:
        # TODO: verify corresponding dimension of reference dataset has same type
        dimension_pandas_dtype = self.primary_dataset.dataframe[dimension_name].dtype
        if is_numeric_dtype(dimension_pandas_dtype):
            return DimensionDataType.NUMERIC
        elif is_object_dtype(dimension_pandas_dtype):
            return DimensionDataType.CATEGORICAL
        raise ValueError("Unrecognized dimension type")
