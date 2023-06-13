from itertools import chain
from operator import itemgetter
from typing import Dict, Iterable, List, Optional, Sized, Tuple

import pandas as pd
from pandas.api.types import is_object_dtype
from typing_extensions import TypeAlias, TypeGuard

from phoenix import Dataset, EmbeddingColumnNames
from phoenix.core.model import _get_embedding_dimensions
from phoenix.core.model_schema import Embedding, Model, Schema
from phoenix.datasets.schema import Schema as DatasetSchema

DatasetName: TypeAlias = str
ColumnName: TypeAlias = str
DisplayName: TypeAlias = str


def create_model_from_datasets(*datasets: Optional[Dataset]) -> Model:
    # TODO: move this validation into model_schema.Model.
    if len(datasets) > 1 and datasets[0] is not None:
        # Check that for each embedding dimension all vectors
        # have the same length between datasets.
        _ = _get_embedding_dimensions(datasets[0], datasets[1])

    named_dataframes: List[Tuple[DatasetName, pd.DataFrame]] = []
    prediction_ids: List[ColumnName] = []
    timestamps: List[ColumnName] = []
    prediction_labels: List[ColumnName] = []
    prediction_scores: List[ColumnName] = []
    actual_labels: List[ColumnName] = []
    actual_scores: List[ColumnName] = []
    features: List[ColumnName] = []
    tags: List[ColumnName] = []
    embeddings: Dict[DisplayName, EmbeddingColumnNames] = {}
    prompts: List[EmbeddingColumnNames] = []
    responses: List[EmbeddingColumnNames] = []

    for dataset in filter(_is_dataset, datasets):
        df = dataset.dataframe
        # Coerce string column names at run time.
        df = df.set_axis(
            map(str, df.columns),
            axis=1,
            copy=False,
        )
        named_dataframes.append((dataset.name, df))
        dataset_schema = dataset.schema if dataset.schema is not None else DatasetSchema()
        for display_name, embedding in (
            dataset_schema.embedding_feature_column_names or {}
        ).items():
            if display_name not in embeddings:
                embeddings[display_name] = embedding
        if dataset_schema.prompt_column_names is not None:
            prompts.append(dataset_schema.prompt_column_names)
        if dataset_schema.response_column_names is not None:
            responses.append(dataset_schema.response_column_names)
        for source, sink in (
            ([dataset_schema.prediction_id_column_name], prediction_ids),
            ([dataset_schema.timestamp_column_name], timestamps),
            ([dataset_schema.prediction_label_column_name], prediction_labels),
            ([dataset_schema.prediction_score_column_name], prediction_scores),
            ([dataset_schema.actual_label_column_name], actual_labels),
            ([dataset_schema.actual_score_column_name], actual_scores),
            (dataset_schema.feature_column_names or (), features),
            (dataset_schema.tag_column_names or (), tags),
        ):
            # Coerce None to "" to simplify type checks.
            sink.extend(map(lambda s: "" if s is None else str(s), source))

    # Deduplicate and remove ""
    tags = list(set(filter(bool, tags)))
    features = list(set(filter(bool, features)))

    # Consolidate column names, by renaming if necessary.
    for specified_column_names in (
        prediction_ids,
        timestamps,
        prediction_labels,
        prediction_scores,
        actual_labels,
        actual_scores,
    ):
        assert len(specified_column_names) == len(named_dataframes)
        if len(set(filter(bool, specified_column_names))) > 1:
            # Rename all columns to match that of the first dataframe.
            pinned_column_name = _take_first_str(specified_column_names)
            for i in range(len(named_dataframes)):
                df_name, df = named_dataframes[i]
                old_column_name = specified_column_names[i]
                if old_column_name and old_column_name in df.columns:
                    named_dataframes[i] = (
                        df_name,
                        df.rename(
                            {old_column_name: pinned_column_name},
                            axis=1,
                        ),
                    )

    translated_embeddings = (
        _translate_embedding(embedding, display_name)
        for display_name, embedding in embeddings.items()
    )

    return Schema(
        prediction_id=_take_first_str(prediction_ids),
        timestamp=_take_first_str(timestamps),
        prediction_label=_take_first_str(prediction_labels),
        prediction_score=_take_first_str(prediction_scores),
        actual_label=_take_first_str(actual_labels),
        actual_score=_take_first_str(actual_scores),
        features=chain(
            *_guess_vectors_vs_scalars(
                features,
                *map(itemgetter(1), named_dataframes),
            ),
            translated_embeddings,
        ),
        tags=chain(
            *_guess_vectors_vs_scalars(
                tags,
                *map(itemgetter(1), named_dataframes),
            )
        ),
        prompt=next(map(_translate_embedding, prompts), None),
        response=next(map(_translate_embedding, responses), None),
    )(
        *named_dataframes,
        timestamps_already_normalized=True,
        df_already_sorted_by_time=True,
        df_already_validated=True,
    )


def _is_dataset(obj: Optional[Dataset]) -> TypeGuard[Dataset]:
    return type(obj) is Dataset


def _take_first_str(iterator: Iterable[str]) -> str:
    return next(iter(filter(bool, iterator)), "")


def _translate_embedding(
    embedding: EmbeddingColumnNames,
    display_name: Optional[str] = None,
) -> Embedding:
    return Embedding(
        vector=embedding.vector_column_name,
        raw_data=embedding.raw_data_column_name,
        link_to_data=embedding.link_to_data_column_name,
        display_name=display_name,
    )


def _guess_vectors_vs_scalars(
    names: Iterable[str],
    *dataframes: pd.DataFrame,
) -> Tuple[List[str], List[Embedding]]:
    """A best-effort attempt at separating vector columns from scalar columns
    by examining the first non-null item of the column from each dataframe. If
    any item is `Iterable` and `Sized`, but not `str`, then the column is
    returned as `Embedding`, else it's returned as scalar.
    """
    scalars: List[str] = []
    vectors: List[Embedding] = []
    # convert to sets for a speedier lookup
    column_names = [set(df.columns) for df in dataframes]
    for name in names:
        for i, df in enumerate(dataframes):
            if df.empty or name not in column_names[i]:
                continue
            series = df.loc[:, name]
            if not is_object_dtype(series):
                continue
            item = series.iat[series.isna().argmin()]
            if (
                isinstance(item, str)  # str is scalar, but Iterable
                or not isinstance(item, Iterable)
                or not isinstance(item, Sized)
            ):
                continue
            vectors.append(Embedding(vector=name))
            break
        else:
            scalars.append(name)
    return scalars, vectors
