from itertools import chain
from operator import itemgetter
from typing import Dict, Iterable, List, Optional, Sized, Tuple, Union

import pandas as pd
from pandas.api.types import is_object_dtype
from typing_extensions import TypeAlias, TypeGuard

from phoenix import EmbeddingColumnNames, Inferences
from phoenix.core.model import _get_embedding_dimensions
from phoenix.core.model_schema import Embedding, Model, RetrievalEmbedding, Schema
from phoenix.inferences.schema import RetrievalEmbeddingColumnNames
from phoenix.inferences.schema import Schema as InferencesSchema

InferencesName: TypeAlias = str
ColumnName: TypeAlias = str
DisplayName: TypeAlias = str


def create_model_from_inferences(*inference_sets: Optional[Inferences]) -> Model:
    # TODO: move this validation into model_schema.Model.
    if len(inference_sets) > 1 and inference_sets[0] is not None:
        # Check that for each embedding dimension all vectors
        # have the same length between inferences.
        _ = _get_embedding_dimensions(inference_sets[0], inference_sets[1])

    named_dataframes: List[Tuple[InferencesName, pd.DataFrame]] = []
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
    responses: List[Union[str, EmbeddingColumnNames]] = []

    for inferences in filter(_is_inferences, inference_sets):
        df = inferences.dataframe
        # Coerce string column names at run time.
        df = df.set_axis(
            map(str, df.columns),
            axis=1,
        )
        named_dataframes.append((inferences.name, df))
        inferences_schema = (
            inferences.schema if inferences.schema is not None else InferencesSchema()
        )
        for display_name, embedding in (
            inferences_schema.embedding_feature_column_names or {}
        ).items():
            if display_name not in embeddings:
                embeddings[display_name] = embedding
        if inferences_schema.prompt_column_names is not None:
            prompts.append(inferences_schema.prompt_column_names)
        if inferences_schema.response_column_names is not None:
            responses.append(inferences_schema.response_column_names)
        for source, sink in (
            ([inferences_schema.prediction_id_column_name], prediction_ids),
            ([inferences_schema.timestamp_column_name], timestamps),
            ([inferences_schema.prediction_label_column_name], prediction_labels),
            ([inferences_schema.prediction_score_column_name], prediction_scores),
            ([inferences_schema.actual_label_column_name], actual_labels),
            ([inferences_schema.actual_score_column_name], actual_scores),
            (inferences_schema.feature_column_names or (), features),
            (inferences_schema.tag_column_names or (), tags),
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
            *_split_vectors_vs_scalars(
                features,
                *map(itemgetter(1), named_dataframes),
            ),
            translated_embeddings,
        ),
        tags=chain(
            *_split_vectors_vs_scalars(
                tags,
                *map(itemgetter(1), named_dataframes),
            )
        ),
        prompt=next(map(_translate_prompt_embedding, prompts), None),
        response=next(map(_translate_response_embedding, responses), None),
    )(
        *named_dataframes,
        timestamps_already_normalized=True,
        df_already_sorted_by_time=True,
        df_already_validated=True,
    )


def _is_inferences(obj: Optional[Inferences]) -> TypeGuard[Inferences]:
    return type(obj) is Inferences


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


def _translate_response_embedding(
    embedding: Union[str, EmbeddingColumnNames],
    display_name: Optional[str] = None,
) -> Union[str, Embedding]:
    if isinstance(embedding, EmbeddingColumnNames):
        return _translate_embedding(embedding, display_name)
    return embedding


def _translate_prompt_embedding(
    embedding: Union[EmbeddingColumnNames, RetrievalEmbeddingColumnNames],
    display_name: Optional[str] = None,
) -> RetrievalEmbedding:
    return RetrievalEmbedding(
        vector=embedding.vector_column_name,
        raw_data=embedding.raw_data_column_name,
        link_to_data=embedding.link_to_data_column_name,
        display_name=display_name,
        context_retrieval_ids=embedding.context_retrieval_ids_column_name
        if isinstance(embedding, RetrievalEmbeddingColumnNames)
        else None,
        context_retrieval_scores=embedding.context_retrieval_scores_column_name
        if isinstance(embedding, RetrievalEmbeddingColumnNames)
        else None,
    )


def _split_vectors_vs_scalars(
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
