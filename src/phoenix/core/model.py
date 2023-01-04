from typing import List

from phoenix.datasets import Dataset

from .dimension import Dimension
from .dimension_type import DimensionType


class Model:
    def __init__(self, primary_dataset_name: str, reference_dataset_name: str):
        # TODO Fail if you can't find the datasets on disc
        self.__primary_dataset = Dataset.from_name(primary_dataset_name)
        self.__reference_dataset = Dataset.from_name(reference_dataset_name)
        self.__dimensions = self._get_dimensions(self.primary_dataset, self.reference_dataset)
        # TODO construct embedding dimensions from the dataset schemas
        self.__embedding_dimensions: List[Dimension] = []

    @staticmethod
    def _get_dimensions(primary_dataset: Dataset, reference_dataset: Dataset) -> List[Dimension]:

        dimensions: List[Dimension] = []
        primary_schema = primary_dataset.schema
        reference_schema = reference_dataset.schema

        # check actual column names are identical and add to output
        primary_actuals, reference_actuals = [
            [schema.actual_label_column_name, schema.actual_score_column_name]
            for schema in [primary_schema, reference_schema]
        ]
        if primary_actuals != reference_actuals:
            raise ValueError()
        for name in primary_actuals:
            if name is not None:
                dimensions.append(
                    Dimension(
                        name=name,
                        data_type=primary_dataset.get_dimension_data_type(name),
                        type=DimensionType.ACTUAL,
                    )
                )

        # check prediction column names are identical and add to output
        primary_predictions, reference_predictions = [
            [schema.actual_label_column_name, schema.actual_score_column_name]
            for schema in [primary_schema, reference_schema]
        ]
        if primary_predictions != reference_predictions:
            raise ValueError()
        for name in primary_predictions:
            if name is not None:
                dimensions.append(
                    Dimension(
                        name=name,
                        data_type=primary_dataset.get_dimension_data_type(name),
                        type=DimensionType.PREDICTION,
                    )
                )

        # check features column names are identical and add to output
        primary_feature_names = primary_schema.feature_column_names
        reference_feature_names = reference_schema.feature_column_names
        if (primary_feature_names is None) != (reference_feature_names is None):
            raise ValueError()
        if primary_feature_names is not None and reference_feature_names is not None:
            if set(primary_feature_names) != set(reference_feature_names):
                raise ValueError()
            for name in primary_feature_names:
                dimensions.append(
                    Dimension(
                        name=name,
                        data_type=primary_dataset.get_dimension_data_type(name),
                        type=DimensionType.FEATURE,
                    )
                )

        # check tag column names are identical and add to output
        primary_tag_names = primary_schema.tag_column_names
        reference_tag_names = reference_schema.tag_column_names
        if (primary_tag_names is None) != (reference_tag_names is None):
            raise ValueError()
        if primary_tag_names is not None and reference_tag_names is not None:
            if set(primary_tag_names) != set(reference_tag_names):
                raise ValueError()
            for name in primary_tag_names:
                dimensions.append(
                    Dimension(
                        name=name,
                        data_type=primary_dataset.get_dimension_data_type(name),
                        type=DimensionType.TAG,
                    )
                )

        return dimensions

    @staticmethod
    def _get_embedding_dimensions(
        primary_dataset: Dataset, reference_dataset: Dataset
    ) -> List[Dimension]:
        raise NotImplementedError()

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
