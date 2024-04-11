import re
from dataclasses import dataclass, replace
from enum import Enum
from itertools import groupby
from typing import Dict

from pandas import DataFrame

from phoenix.inferences.inferences import Inferences
from phoenix.inferences.schema import EmbeddingColumnNames, RetrievalEmbeddingColumnNames, Schema
from phoenix.utilities.deprecation import deprecated, deprecated_class


@deprecated_class("phoenix.Dataset is deprecated, use phoenix.Inference instead.")
class Dataset(Inferences):
    @classmethod
    @deprecated("Dataset.from_open_inference is deprecated and will be removed.")
    def from_open_inference(cls, dataframe: DataFrame) -> "Dataset":
        schema = Schema()
        column_renaming: Dict[str, str] = {}
        for group_name, group in groupby(
            sorted(
                map(_parse_open_inference_column_name, dataframe.columns),
                key=lambda column: column.name,
            ),
            key=lambda column: column.name,
        ):
            open_inference_columns = list(group)
            if group_name == "":
                column_names_by_category = {
                    column.category: column.full_name for column in open_inference_columns
                }
                schema = replace(
                    schema,
                    prediction_id_column_name=column_names_by_category.get(
                        OpenInferenceCategory.id
                    ),
                    timestamp_column_name=column_names_by_category.get(
                        OpenInferenceCategory.timestamp
                    ),
                )
                continue
            column_names_by_specifier = {
                column.specifier: column.full_name for column in open_inference_columns
            }
            if group_name == "response":
                response_vector_column_name = column_names_by_specifier.get(
                    OpenInferenceSpecifier.embedding
                )
                if response_vector_column_name is not None:
                    column_renaming[response_vector_column_name] = "response"
                    schema = replace(
                        schema,
                        response_column_names=EmbeddingColumnNames(
                            vector_column_name=column_renaming[response_vector_column_name],
                            raw_data_column_name=column_names_by_specifier.get(
                                OpenInferenceSpecifier.default
                            ),
                        ),
                    )
                else:
                    response_text_column_name = column_names_by_specifier.get(
                        OpenInferenceSpecifier.default
                    )
                    if response_text_column_name is None:
                        raise ValueError(
                            "invalid OpenInference format: missing text column for response"
                        )
                    column_renaming[response_text_column_name] = "response"
                    schema = replace(
                        schema,
                        response_column_names=column_renaming[response_text_column_name],
                    )
            elif group_name == "prompt":
                prompt_vector_column_name = column_names_by_specifier.get(
                    OpenInferenceSpecifier.embedding
                )
                if prompt_vector_column_name is None:
                    raise ValueError(
                        "invalid OpenInference format: missing embedding vector column for prompt"
                    )
                column_renaming[prompt_vector_column_name] = "prompt"
                schema = replace(
                    schema,
                    prompt_column_names=RetrievalEmbeddingColumnNames(
                        vector_column_name=column_renaming[prompt_vector_column_name],
                        raw_data_column_name=column_names_by_specifier.get(
                            OpenInferenceSpecifier.default
                        ),
                        context_retrieval_ids_column_name=column_names_by_specifier.get(
                            OpenInferenceSpecifier.retrieved_document_ids
                        ),
                        context_retrieval_scores_column_name=column_names_by_specifier.get(
                            OpenInferenceSpecifier.retrieved_document_scores
                        ),
                    ),
                )
            elif OpenInferenceSpecifier.embedding in column_names_by_specifier:
                vector_column_name = column_names_by_specifier[OpenInferenceSpecifier.embedding]
                column_renaming[vector_column_name] = group_name
                embedding_feature_column_names = schema.embedding_feature_column_names or {}
                embedding_feature_column_names.update(
                    {
                        group_name: EmbeddingColumnNames(
                            vector_column_name=column_renaming[vector_column_name],
                            raw_data_column_name=column_names_by_specifier.get(
                                OpenInferenceSpecifier.raw_data
                            ),
                            link_to_data_column_name=column_names_by_specifier.get(
                                OpenInferenceSpecifier.link_to_data
                            ),
                        )
                    }
                )
                schema = replace(
                    schema,
                    embedding_feature_column_names=embedding_feature_column_names,
                )
            elif len(open_inference_columns) == 1:
                open_inference_column = open_inference_columns[0]
                raw_column_name = open_inference_column.full_name
                column_renaming[raw_column_name] = open_inference_column.name
                if open_inference_column.category is OpenInferenceCategory.feature:
                    schema = replace(
                        schema,
                        feature_column_names=(
                            (schema.feature_column_names or []) + [column_renaming[raw_column_name]]
                        ),
                    )
                elif open_inference_column.category is OpenInferenceCategory.tag:
                    schema = replace(
                        schema,
                        tag_column_names=(
                            (schema.tag_column_names or []) + [column_renaming[raw_column_name]]
                        ),
                    )
                elif open_inference_column.category is OpenInferenceCategory.prediction:
                    if open_inference_column.specifier is OpenInferenceSpecifier.score:
                        schema = replace(
                            schema,
                            prediction_score_column_name=column_renaming[raw_column_name],
                        )
                    if open_inference_column.specifier is OpenInferenceSpecifier.label:
                        schema = replace(
                            schema,
                            prediction_label_column_name=column_renaming[raw_column_name],
                        )
                elif open_inference_column.category is OpenInferenceCategory.actual:
                    if open_inference_column.specifier is OpenInferenceSpecifier.score:
                        schema = replace(
                            schema,
                            actual_score_column_name=column_renaming[raw_column_name],
                        )
                    if open_inference_column.specifier is OpenInferenceSpecifier.label:
                        schema = replace(
                            schema,
                            actual_label_column_name=column_renaming[raw_column_name],
                        )
            else:
                raise ValueError(f"invalid OpenInference format: duplicated name `{group_name}`")

        return cls(
            dataframe.rename(
                column_renaming,
                axis=1,
                copy=False,
            ),
            schema,
        )


class OpenInferenceCategory(Enum):
    id = "id"
    timestamp = "timestamp"
    feature = "feature"
    tag = "tag"
    prediction = "prediction"
    actual = "actual"


class OpenInferenceSpecifier(Enum):
    default = ""
    score = "score"
    label = "label"
    embedding = "embedding"
    raw_data = "raw_data"
    link_to_data = "link_to_data"
    retrieved_document_ids = "retrieved_document_ids"
    retrieved_document_scores = "retrieved_document_scores"


@dataclass(frozen=True)
class _OpenInferenceColumnName:
    full_name: str
    category: OpenInferenceCategory
    data_type: str
    specifier: OpenInferenceSpecifier = OpenInferenceSpecifier.default
    name: str = ""


def _parse_open_inference_column_name(column_name: str) -> _OpenInferenceColumnName:
    pattern = (
        r"^:(?P<category>\w+)\.(?P<data_type>\[\w+\]|\w+)(\.(?P<specifier>\w+))?:(?P<name>.*)?$"
    )
    if match := re.match(pattern, column_name):
        extract = match.groupdict(default="")
        return _OpenInferenceColumnName(
            full_name=column_name,
            category=OpenInferenceCategory(extract.get("category", "").lower()),
            data_type=extract.get("data_type", "").lower(),
            specifier=OpenInferenceSpecifier(extract.get("specifier", "").lower()),
            name=extract.get("name", ""),
        )
    raise ValueError(f"Invalid format for column name: {column_name}")
