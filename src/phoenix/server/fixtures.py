import logging
import os
from dataclasses import dataclass
from typing import Tuple

from pandas import read_parquet

from phoenix.datasets import Dataset, EmbeddingColumnNames, Schema

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Fixture:
    name: str
    primary_dataset_url: str
    reference_dataset_url: str
    primary_schema: Schema
    reference_schema: Schema


FIXTURE_URL_PREFIX = "https://storage.googleapis.com/arize-assets/phoenix/datasets/"

sentiment_classification_language_drift_schema = Schema(
    timestamp_column_name="prediction_ts",
    feature_column_names=[
        "reviewer_age",
        "reviewer_gender",
        "product_category",
        "language",
    ],
    embedding_feature_column_names={
        "text_embedding": EmbeddingColumnNames(vector_column_name="text_vector")
    },
)
sentiment_classification_language_drift_fixture = Fixture(
    name="sentiment_classification_language_drift",
    primary_schema=sentiment_classification_language_drift_schema,
    reference_schema=sentiment_classification_language_drift_schema,
    primary_dataset_url=os.path.join(
        FIXTURE_URL_PREFIX,
        "unstructured/nlp/sentiment_classification_language_drift_production.parquet",
    ),
    reference_dataset_url=os.path.join(
        FIXTURE_URL_PREFIX,
        "unstructured/nlp/sentiment_classification_language_drift_training.parquet",
    ),
)

fashion_mnist_primary_schema = Schema(
    timestamp_column_name="prediction_ts",
    embedding_feature_column_names={
        "embedding": EmbeddingColumnNames(
            vector_column_name="embeddings", link_to_data_column_name="image_url"
        ),
    },
    actual_label_column_name="actual_label",
    prediction_label_column_name="predicted_label",
)
fashion_mnist_reference_schema = Schema(
    embedding_feature_column_names={
        "embedding": EmbeddingColumnNames(
            vector_column_name="embeddings", link_to_data_column_name="image_url"
        ),
    },
    actual_label_column_name="actual_label",
    prediction_label_column_name="predicted_label",
)
fashion_mnist_fixture = Fixture(
    name="fashion_mnist",
    primary_schema=fashion_mnist_primary_schema,
    reference_schema=fashion_mnist_reference_schema,
    primary_dataset_url=os.path.join(
        FIXTURE_URL_PREFIX,
        "unstructured/cv/fashion-mnist/fashion_mnist_production.parquet",
    ),
    reference_dataset_url=os.path.join(
        FIXTURE_URL_PREFIX,
        "unstructured/cv/fashion-mnist/fashion_mnist_train.parquet",
    ),
)

ner_token_drift_schema = Schema(
    timestamp_column_name="prediction_ts",
    feature_column_names=["language"],
    actual_label_column_name="label",
    prediction_label_column_name="pred_label",
    embedding_feature_column_names={
        "embedding": EmbeddingColumnNames(
            vector_column_name="token_vector", raw_data_column_name="text"
        )
    },
)
ner_token_drift_fixture = Fixture(
    name="ner_token_drift",
    primary_schema=ner_token_drift_schema,
    reference_schema=ner_token_drift_schema,
    primary_dataset_url=os.path.join(
        FIXTURE_URL_PREFIX,
        "unstructured/nlp/named-entity-recognition/ner_token_drift_production.parquet",
    ),
    reference_dataset_url=os.path.join(
        FIXTURE_URL_PREFIX,
        "unstructured/nlp/named-entity-recognition/ner_token_drift_train.parquet",
    ),
)

wide_data_primary_schema = Schema(
    actual_label_column_name="actual_label",
    prediction_label_column_name="predicted_label",
    timestamp_column_name="prediction_ts",
)
wide_data_reference_schema = Schema(
    actual_label_column_name="actual_label",
    prediction_label_column_name="predicted_label",
)
wide_data_fixture = Fixture(
    name="wide_data",
    primary_schema=wide_data_primary_schema,
    reference_schema=wide_data_reference_schema,
    primary_dataset_url=os.path.join(
        FIXTURE_URL_PREFIX,
        "structured/wide-data/wide_data_production.parquet",
    ),
    reference_dataset_url=os.path.join(
        FIXTURE_URL_PREFIX,
        "structured/wide-data/wide_data_train.parquet",
    ),
)

FIXTURES: Tuple[Fixture, ...] = (
    sentiment_classification_language_drift_fixture,
    fashion_mnist_fixture,
    ner_token_drift_fixture,
    wide_data_fixture,
)
NAME_TO_FIXTURE = {fixture.name: fixture for fixture in FIXTURES}


def download_fixture_if_missing(fixture_name: str) -> Tuple[str, str]:
    """
    Downloads primary and reference datasets for a fixture if they are not found
    locally. Returns the names of the primary and reference datasets.
    """
    fixture = _get_fixture_by_name(fixture_name=fixture_name)
    primary_dataset_name = f"{fixture_name}_primary"
    reference_dataset_name = f"{fixture_name}_reference"
    _download_and_persist_dataset_if_missing(
        dataset_name=primary_dataset_name,
        dataset_url=fixture.primary_dataset_url,
        schema=fixture.primary_schema,
    )
    _download_and_persist_dataset_if_missing(
        dataset_name=reference_dataset_name,
        dataset_url=fixture.reference_dataset_url,
        schema=fixture.reference_schema,
    )
    return primary_dataset_name, reference_dataset_name


def _get_fixture_by_name(fixture_name: str) -> Fixture:
    """
    Returns the fixture whose name matches the input name. Raises a ValueError
    if the input fixture name does not match any known fixture names.
    """
    if fixture_name not in NAME_TO_FIXTURE:
        raise ValueError(f'"{fixture_name}" is not a valid fixture name.')
    return NAME_TO_FIXTURE[fixture_name]


def _download_and_persist_dataset_if_missing(
    dataset_name: str, dataset_url: str, schema: Schema
) -> None:
    """
    Downloads a dataset from the given URL if it is not found locally.
    """
    try:
        Dataset.from_name(dataset_name)
        return
    except FileNotFoundError:
        pass

    logger.info(f'Downloading dataset: "{dataset_name}"')
    Dataset(
        dataframe=read_parquet(dataset_url),
        schema=schema,
        name=dataset_name,
        persist_to_disc=True,
    )
    logger.info("Download complete.")
