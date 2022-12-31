from typing import List

from phoenix.datasets import Dataset

from .dimension import Dimension
from .dimension_type import DimensionType


class Model:
    def __init__(self, primary_dataset_name: str, reference_dataset_name: str):
        self.primary_dataset_name = primary_dataset_name
        self.reference_dataset_name = reference_dataset_name
        # TODO Fail if you can't find the datasets on disc
        self.primary_dataset = Dataset.from_name(primary_dataset_name)
        self.reference_dataset = Dataset.from_name(reference_dataset_name)
        # TODO construct model dimensions from the dataset schemas
        self.__dimensions = self._get_dimensions(self.primary_dataset, self.reference_dataset)
        self.__embedding_dimensions = self._get_embedding_dimensions(
            self.primary_dataset, self.reference_dataset
        )

    @staticmethod
    def _get_dimensions(primary_dataset: Dataset, reference_dataset: Dataset) -> List[Dimension]:

        dimensions = []
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
        # dimensions = []
        # primary_schema = primary_dataset.schema
        # reference_schema = reference_dataset.schema
        # primary_embedding_feature_names = primary_schema.embedding_feature_column_names
        # reference_embedding_feature_names = reference_schema.embedding_feature_column_names
        # num_datasets_with_embeddings = sum(
        #     x is not None
        #     for x in [primary_embedding_feature_names, reference_embedding_feature_names]
        # )

        # if num_datasets_with_embeddings == 1 or (
        #     num_datasets_with_embeddings == 2
        #     and set(primary_embedding_feature_names) != set(reference_embedding_feature_names)
        # ):
        #     raise ValueError()
        # elif num_datasets_with_embeddings == 2:
        #     for name in primary_schema.embedding_feature_column_names:
        #         dimensions.append(
        #             Dimension(
        #                 name=name,
        #                 data_type=primary_dataset.get_dimension_data_type(name),
        #                 type=DimensionType.EMBEDDING,
        #             )
        #         )
        # return dimensions

        return []

    @property
    def dimensions(self) -> List[Dimension]:
        return self.__dimensions

    @property
    def embedding_dimensions(self) -> List[Dimension]:
        return self.__embedding_dimensions
