import logging
import os
from dataclasses import dataclass, replace
from typing import Dict, Tuple

from pandas import read_parquet

from .dataset import Dataset
from .schema import EmbeddingColumnNames, Schema

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Fixture:
    name: str
    description: str
    primary_dataset_url: str
    reference_dataset_url: str
    primary_schema: Schema
    reference_schema: Schema


FIXTURE_URL_PREFIX = "https://storage.googleapis.com/arize-assets/phoenix/datasets/"

sentiment_classification_language_drift_schema = Schema(
    timestamp_column_name="prediction_ts",
    prediction_label_column_name="pred_label",
    actual_label_column_name="label",
    embedding_feature_column_names={
        "text_embedding": EmbeddingColumnNames(
            vector_column_name="text_vector", raw_data_column_name="text"
        ),
    },
)
sentiment_classification_language_drift_fixture = Fixture(
    name="sentiment_classification_language_drift",
    description="""
    Highlights issues that occur maintaining a sentiment classification model.
    This  model takes online reviews of your U.S.-based product as the input and predict whether
    the reviewer's sentiment was positive, negative, or neutral.

    You trained your sentiment classification model on English reviews.
    However, once the model was released into production, you notice that the performance of the
    model has degraded over a period of time.

    Phoenix is able to surface the reason for this performance degradation.
    In this example, the presence of reviews written in Spanish impact the model's performance.
    You can surface and troubleshoot this issue by analyzing the embedding vectors associated
    with the online review text.
    """,
    primary_schema=sentiment_classification_language_drift_schema,
    reference_schema=sentiment_classification_language_drift_schema,
    primary_dataset_url=os.path.join(
        FIXTURE_URL_PREFIX,
        "unstructured/nlp/sentiment-classification-language-drift",
        "sentiment_classification_language_drift_production.parquet",
    ),
    reference_dataset_url=os.path.join(
        FIXTURE_URL_PREFIX,
        "unstructured/nlp/sentiment-classification-language-drift",
        "sentiment_classification_language_drift_training.parquet",
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
fashion_mnist_reference_schema = replace(fashion_mnist_primary_schema, timestamp_column_name=None)
fashion_mnist_fixture = Fixture(
    name="fashion_mnist",
    description="""
    Fashion-MNIST is a dataset of Zalando's article images—consisting of a training set of
    60,000 examples and a test set of 10,000 examples. Each example is a 28x28 grayscale image,
    associated with a label from 10 classes. Fashion-MNIST to serve as a direct drop-in replacement
    for the original MNIST dataset for benchmarking machine learning algorithms.
    It shares the same image size and structure of training and testing splits.
    """,
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
    description="""
    You are in charge of maintaining a Named Entity Recognition (NER) model.
    This simple model can automatically scan text, pull out some fundamental entities within it,
    and classify them into predefined categories: Person, Location, or Organization.
    However, once the model was released into production, you notice that the performance of the
    model has degraded over a period of time.

    Phoenix is able to surface the reason for this performance degradation.
    In this example, text including locations is under-represented in the training set.
    This label imbalance impacts the model's performance. You can surface and troubleshoot this
    issue by analyzing the embedding vectors associated with the input text.

    According to our research, inspecting embedding drift can surface problems with your data before
    they cause performance degradation.
    """,
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

credit_card_fraud_schema = Schema(
    prediction_id_column_name="prediction_id",
    prediction_label_column_name="predicted_label",
    prediction_score_column_name="predicted_score",
    actual_label_column_name="actual_label",
    timestamp_column_name="prediction_timestamp",
    tag_column_names=["age"],
)
credit_card_fraud_fixture = Fixture(
    name="credit_card_fraud",
    description="""
    Use-case that for a credit card fraud model at a large bank or payment processing company.

    You have been alerted by a spike in credit card chargebacks leading you to suspect that
    fraudsters are getting away with committing fraud undetected!

    Realizing that this flaw in your model's performance has a heavy cost on your
    company and customers, you understand the need for a powerful tools to troubleshoot and prevent
    costly model degradations. You turn to Phoenix to find out what changed in your credit card
    fraud detection model and how you can improve it.
    """,
    primary_schema=credit_card_fraud_schema,
    reference_schema=credit_card_fraud_schema,
    primary_dataset_url=os.path.join(
        FIXTURE_URL_PREFIX, "structured/credit-card-fraud/credit_card_fraud_production.parquet"
    ),
    reference_dataset_url=os.path.join(
        FIXTURE_URL_PREFIX,
        "structured/credit-card-fraud/credit_card_fraud_train.parquet",
    ),
)

click_through_rate_schema = Schema(
    timestamp_column_name="prediction_timestamp",
    prediction_id_column_name="prediction_id",
    prediction_label_column_name="predicted_label",
    prediction_score_column_name="predicted_score",
    actual_label_column_name="actual_label",
)
click_through_rate_fixture = Fixture(
    name="click_through_rate",
    description="""
    Investigate various performance related aspects of an online advertisement use-case.
    More specifically we will be using Phoenix to monitor Click-through Rate (CTR) performance.

    You manage the models for an online advertising platform.
    You have spent a great deal of your time collecting online data and training models
    for best performance. With your models now in production you have no tools available to your
    disposal to monitor the performance of your models, identify any issues or get insights into
    how to improve your models. In this walkthrough we will look at a few scenarios common to an
    advertisement use-case and more specifically looking at CTR predictions versus actuals for a
    given ad or ad group.
    """,
    primary_schema=click_through_rate_schema,
    reference_schema=click_through_rate_schema,
    primary_dataset_url=os.path.join(
        FIXTURE_URL_PREFIX, "structured/click-through-rate/click_through_rate_production.parquet"
    ),
    reference_dataset_url=os.path.join(
        FIXTURE_URL_PREFIX, "structured/click-through-rate/click_through_rate_train.parquet"
    ),
)

wide_data_primary_schema = Schema(
    actual_label_column_name="actual_label",
    prediction_label_column_name="predicted_label",
    timestamp_column_name="prediction_ts",
)
wide_data_reference_schema = replace(wide_data_primary_schema, timestamp_column_name=None)
wide_data_fixture = Fixture(
    name="wide_data",
    description="""
    Use-case that for a wide data model (e.g. a large amount of features).
    For developer use only.
    """,
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

deep_data_primary_schema = Schema(
    timestamp_column_name="prediction_ts",
    actual_label_column_name="actual_label",
    prediction_label_column_name="predicted_label",
)
deep_data_reference_schema = replace(deep_data_primary_schema, timestamp_column_name=None)
deep_data_fixture = Fixture(
    name="deep_data",
    description="""
    Use-case that for a deep data model (e.g. a lot of feature values).
    For developer use only.
    """,
    primary_schema=deep_data_primary_schema,
    reference_schema=deep_data_reference_schema,
    primary_dataset_url=os.path.join(
        FIXTURE_URL_PREFIX,
        "structured/deep-data/deep_data_production.parquet",
    ),
    reference_dataset_url=os.path.join(
        FIXTURE_URL_PREFIX,
        "structured/deep-data/deep_data_train.parquet",
    ),
)

FIXTURES: Tuple[Fixture, ...] = (
    sentiment_classification_language_drift_fixture,
    fashion_mnist_fixture,
    ner_token_drift_fixture,
    credit_card_fraud_fixture,
    click_through_rate_fixture,
    wide_data_fixture,
    deep_data_fixture,
)
NAME_TO_FIXTURE = {fixture.name: fixture for fixture in FIXTURES}


def download_fixture_if_missing(fixture_name: str) -> Tuple[Dataset, Dataset]:
    """
    Downloads primary and reference datasets for a fixture if they are not found
    locally.
    """
    fixture = _get_fixture_by_name(fixture_name=fixture_name)
    primary_dataset_name, reference_dataset_name = get_dataset_names_from_fixture_name(fixture_name)
    primary_dataset = _download_and_persist_dataset_if_missing(
        dataset_name=primary_dataset_name,
        dataset_url=fixture.primary_dataset_url,
        schema=fixture.primary_schema,
    )
    reference_dataset = _download_and_persist_dataset_if_missing(
        dataset_name=reference_dataset_name,
        dataset_url=fixture.reference_dataset_url,
        schema=fixture.reference_schema,
    )
    return primary_dataset, reference_dataset


def get_dataset_names_from_fixture_name(fixture_name: str) -> Tuple[str, str]:
    """
    Gets primary and reference dataset names from fixture name.
    """
    primary_dataset_name = f"{fixture_name}_primary"
    reference_dataset_name = f"{fixture_name}_reference"
    return primary_dataset_name, reference_dataset_name


def _get_fixture_by_name(fixture_name: str) -> Fixture:
    """
    Returns the fixture whose name matches the input name. Raises a ValueError
    if the input fixture name does not match any known fixture names.
    """
    if fixture_name not in NAME_TO_FIXTURE:
        valid_fixture_names = ", ".join(NAME_TO_FIXTURE.keys())
        raise ValueError(f'"{fixture_name}" is invalid. Valid names are: {valid_fixture_names}')
    return NAME_TO_FIXTURE[fixture_name]


def _download_and_persist_dataset_if_missing(
    dataset_name: str, dataset_url: str, schema: Schema
) -> Dataset:
    """
    Downloads a dataset from the given URL if it is not found locally.
    """
    try:
        return Dataset.from_name(dataset_name)
    except FileNotFoundError:
        pass

    logger.info(f'Downloading dataset: "{dataset_name}"')
    dataset = Dataset(
        dataframe=read_parquet(dataset_url),
        schema=schema,
        name=dataset_name,
        persist_to_disc=True,
    )
    logger.info("Download complete.")
    return dataset


@dataclass(frozen=True)
class DatasetDict(Dict[str, Dataset]):
    """A dictionary of datasets, split out by dataset type (primary, reference)."""

    primary: Dataset
    reference: Dataset


def load_example(use_case: str) -> DatasetDict:
    """
    Loads an example primary and reference dataset for a given use-case.

    Parameters
    ----------
        use_case: str
            Name of the phoenix supported use case
            Valid values include:
                - "sentiment_classification_language_drift"
                - "fashion_mnist"
                - "ner_token_drift"
                - "credit_card_fraud"
                - "click_through_rate"


    Returns
    _______
        datasets: DatasetDict
            A dictionary of datasets, split out by dataset type (primary, reference).

    """
    fixture = _get_fixture_by_name(use_case)
    primary_dataset, reference_dataset = download_fixture_if_missing(use_case)
    print(f"📥 Loaded {use_case} example datasets.")
    print("ℹ️ About this use-case:")
    print(fixture.description)
    return DatasetDict(primary=primary_dataset, reference=reference_dataset)
