from itertools import chain, groupby
from typing import Iterable, Iterator, List, Optional, Tuple

import pandas as pd
from typing_extensions import TypeAlias, TypeGuard

from phoenix import Dataset, EmbeddingColumnNames
from phoenix.core.model_schema import Embedding, Model, Schema
from phoenix.datasets.schema import Schema as DatasetSchema

DatasetName: TypeAlias = str
ColumnName: TypeAlias = str
DisplayName: TypeAlias = str


def create_model_from_datasets(*datasets: Optional[Dataset]) -> Model:
    named_dataframes: List[Tuple[DatasetName, pd.DataFrame]] = []
    prediction_ids: List[ColumnName] = []
    timestamps: List[ColumnName] = []
    prediction_labels: List[ColumnName] = []
    prediction_scores: List[ColumnName] = []
    actual_labels: List[ColumnName] = []
    actual_scores: List[ColumnName] = []
    features: List[ColumnName] = []
    tags: List[ColumnName] = []
    embeddings: List[Tuple[DisplayName, EmbeddingColumnNames]] = []

    for dataset in filter(_is_dataset, datasets):
        df = dataset.dataframe
        # Ensure string column names at run time.
        df = df.set_axis(map(str, df.columns), axis=1)
        named_dataframes.append((dataset.name, df))
        schema = dataset.schema if dataset.schema is not None else DatasetSchema()
        embeddings.extend((schema.embedding_feature_column_names or {}).items())
        for source, sink in (
            ([schema.prediction_id_column_name], prediction_ids),
            ([schema.timestamp_column_name], timestamps),
            ([schema.prediction_label_column_name], prediction_labels),
            ([schema.prediction_score_column_name], prediction_scores),
            ([schema.actual_label_column_name], actual_labels),
            ([schema.actual_score_column_name], actual_scores),
            (schema.feature_column_names or (), features),
            (schema.tag_column_names or (), tags),
        ):
            # Coerce None to "" to simplify type checks.
            sink.extend(map(lambda s: "" if s is None else str(s), source))

    tags = list(set(filter(bool, tags)))
    features = list(set(filter(bool, features)))

    # Consolidate column names, by renaming if necessary.
    for df_column_names in (
        prediction_ids,
        timestamps,
        prediction_labels,
        prediction_scores,
        actual_labels,
        actual_scores,
    ):
        assert len(df_column_names) == len(named_dataframes)
        if len(set(filter(bool, df_column_names))) > 1:
            # Rename all columns to match that of the first dataframe.
            column_name = _take_first(df_column_names)
            for i in range(len(named_dataframes)):
                df_name, df = named_dataframes[i]
                old_column_name = df_column_names[i]
                if old_column_name and old_column_name in df.columns:
                    named_dataframes[i] = (
                        df_name,
                        df.rename({old_column_name: column_name}, axis=1),
                    )

    return Schema(
        prediction_id=_take_first(prediction_ids),
        timestamp=_take_first(timestamps),
        prediction_label=_take_first(prediction_labels),
        prediction_score=_take_first(prediction_scores),
        actual_label=_take_first(actual_labels),
        actual_score=_take_first(actual_scores),
        features=chain(features, _translate_embeddings(embeddings)),
        tags=tags,
    )(
        *named_dataframes,
        timestamps_already_normalized=True,
        df_already_sorted_by_time=True,
        df_already_validated=True,
    )


def _is_dataset(obj: Optional[Dataset]) -> TypeGuard[Dataset]:
    return type(obj) is Dataset


def _take_first(it: Iterable[str]) -> str:
    return next(iter(filter(bool, it)), "")


def _emb_key(t: Tuple[DisplayName, EmbeddingColumnNames]) -> str:
    return t[1].vector_column_name


def _translate_embeddings(
    embeddings: Iterable[Tuple[DisplayName, EmbeddingColumnNames]],
) -> Iterator[Embedding]:
    for name, group in groupby(
        sorted(set(embeddings), key=_emb_key),
        key=_emb_key,
    ):
        if len(embs := list(group)) > 1:
            raise ValueError("duplicate specification of embeddings: %s" % repr(embs))
        emb = embs[0]
        yield Embedding(
            vector=emb[1].vector_column_name,
            raw_data=emb[1].raw_data_column_name,
            link=emb[1].link_to_data_column_name,
            display_name=emb[0],
        )
