from typing import List

from pandas.api.types import is_numeric_dtype, is_object_dtype

from phoenix.datasets import Dataset

from .dimension import Dimension
from .dimension_data_type import DimensionDataType
from .dimension_type import DimensionType


class Model:
    def __init__(self, primary_dataset_name: str, reference_dataset_name: str):
        # TODO Fail if you can't find the datasets on disc
        self.__primary_dataset = Dataset.from_name(primary_dataset_name)
        self.__reference_dataset = Dataset.from_name(reference_dataset_name)
        self.__dimensions = self._get_dimensions(self.primary_dataset, self.reference_dataset)
        # TODO construct embedding dimensions from the dataset schemas
        self.__embedding_dimensions: List[Dimension] = []

    @property
    def primary_dataset(self) -> Dataset:
        return self.__primary_dataset

    @property
    def reference_dataset(self) -> Dataset:
        return self.__reference_dataset

    @property
    def dimensions(self) -> List[Dimension]:
        return self.__dimensions

    @property
    def embedding_dimensions(self) -> List[Dimension]:
        return self.__embedding_dimensions

    def _get_dimensions(
        self, primary_dataset: Dataset, reference_dataset: Dataset
    ) -> List[Dimension]:
        # TODO: include reference dataset dimensions
        dimensions: List[Dimension] = []
        primary_schema = primary_dataset.schema

        # add actual dimensions
        primary_actual_column_names = [
            primary_schema.actual_label_column_name,
            primary_schema.actual_score_column_name,
        ]
        for name in primary_actual_column_names:
            if name is not None:
                dimensions.append(
                    Dimension(
                        name=name,
                        data_type=self._infer_dimension_data_type(name),
                        type=DimensionType.ACTUAL,
                    )
                )

        # add predicted dimensions
        primary_prediction_column_names = [
            primary_schema.actual_label_column_name,
            primary_schema.actual_score_column_name,
        ]
        for name in primary_prediction_column_names:
            if name is not None:
                dimensions.append(
                    Dimension(
                        name=name,
                        data_type=self._infer_dimension_data_type(name),
                        type=DimensionType.PREDICTION,
                    )
                )

        # add feature dimensions
        primary_feature_names = primary_schema.feature_column_names
        if primary_feature_names is not None:
            for name in primary_feature_names:
                dimensions.append(
                    Dimension(
                        name=name,
                        data_type=self._infer_dimension_data_type(name),
                        type=DimensionType.FEATURE,
                    )
                )

        # add tag dimensions
        primary_tag_names = primary_schema.tag_column_names
        if primary_tag_names is not None:
            for name in primary_tag_names:
                dimensions.append(
                    Dimension(
                        name=name,
                        data_type=self._infer_dimension_data_type(name),
                        type=DimensionType.TAG,
                    )
                )

        return dimensions

    @staticmethod
    def _get_embedding_dimensions(
        primary_dataset: Dataset, reference_dataset: Dataset
    ) -> List[Dimension]:
        raise NotImplementedError()

    def _infer_dimension_data_type(self, dimension_name: str) -> DimensionDataType:
        # TODO: verify corresponding dimension of reference dataset has same type
        dataframe_dtype = self.primary_dataset.dataframe[dimension_name].dtype
        if is_numeric_dtype(dataframe_dtype):  # type: ignore
            return DimensionDataType.NUMERIC
        elif is_object_dtype(dataframe_dtype):  # type: ignore
            return DimensionDataType.CATEGORICAL
        raise ValueError("Unrecognized dimension type")
