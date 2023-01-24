import atexit
import errno
import logging
import os
from argparse import ArgumentParser, Namespace
from copy import deepcopy
from dataclasses import dataclass
from typing import Tuple

import uvicorn
from pandas import read_parquet

import phoenix.config as config
from phoenix.datasets import Dataset, EmbeddingColumnNames, Schema
from phoenix.server.app import create_app

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


def _parse_arguments_and_download_fixtures_if_necessary(
    arguments: Namespace,
) -> Namespace:
    """
    Returns a new set of parsed command line arguments and downloads fixtures if
    specified by name and not found locally.

    Primary and reference datasets can be specified either explicitly by naming
    existing datasets or implicitly by passing the name of a fixture. If a
    fixture is specified and is not found locally, the corresponding primary and
    reference datasets will be downloaded. Returns a parsed `Namespace` object
    with updated primary and reference dataset names and with the fixture
    argument removed.
    """
    primary_dataset_name: str
    reference_dataset_name: str
    provided_primary_and_reference_flags_only = (
        isinstance(arguments.primary, str)
        and isinstance(arguments.reference, str)
        and arguments.fixture is None
    )
    provided_fixture_flag_only = (
        arguments.primary is None
        and arguments.reference is None
        and isinstance(arguments.fixture, str)
    )
    if provided_primary_and_reference_flags_only:
        primary_dataset_name = arguments.primary
        reference_dataset_name = arguments.reference
    elif provided_fixture_flag_only:
        (
            primary_dataset_name,
            reference_dataset_name,
        ) = _download_fixture_if_missing(fixture_name=arguments.fixture)
    else:
        raise ValueError(
            'Primary and reference datasets can be specified either explicitly via the "--primary" '
            'and "--reference" flags (in which case the "--fixture" flag should be omitted) or '
            'implicitly via the "--fixture" flag (in which case the "--primary" and "--reference" '
            "flags should be omitted)."
        )
    parsed_arguments = deepcopy(arguments)
    parsed_arguments.primary = primary_dataset_name
    parsed_arguments.reference = reference_dataset_name
    parsed_arguments.fixture = None
    return parsed_arguments


def _download_fixture_if_missing(fixture_name: str) -> Tuple[str, str]:
    """
    Downloads primary and reference datasets for a fixture if they are not found
    locally. Returns the names of the primary and reference datasets.
    """
    fixture = _find_fixture_by_name(fixture_name=fixture_name)
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


def _find_fixture_by_name(fixture_name: str) -> Fixture:
    """
    Returns the fixture whose name matches the input name. Raises a ValueError
    if the input fixture name does not match any known fixture names.
    """
    for fixture in FIXTURES:
        if fixture.name == fixture_name:
            return fixture
    raise ValueError(f'"{fixture_name}" is not a valid fixture name.')


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

    print(f'Downloading dataset: "{dataset_name}"')
    Dataset(
        dataframe=read_parquet(dataset_url),
        schema=schema,
        name=dataset_name,
        persist_to_disc=True,
    )
    print("Download complete.")


def _write_pid_file() -> None:
    with open(_get_pid_file(), "w"):
        pass


def _remove_pid_file() -> None:
    try:
        os.unlink(_get_pid_file())
    except OSError as e:
        if e.errno == errno.ENOENT:
            # If the pid file doesn't exist, ignore and continue on since
            # we are already in the desired end state; This should not happen
            pass
        else:
            raise


def _get_pid_file() -> str:
    return os.path.join(config.get_pids_path(), "%d" % os.getpid())


if __name__ == "__main__":
    # automatically remove the pid file when the process is being gracefully terminated
    atexit.register(_remove_pid_file)
    _write_pid_file()

    parser = ArgumentParser()
    parser.add_argument("--primary", type=str)
    parser.add_argument("--reference", type=str)
    parser.add_argument("--fixture", type=str, choices=[fixture.name for fixture in FIXTURES])
    parser.add_argument("--port", type=int, default=config.port)
    parser.add_argument("--graphiql", action="store_true")
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()

    args = _parse_arguments_and_download_fixtures_if_necessary(args)

    print(
        f"""Starting Phoenix App
            primary dataset: {args.primary}
            reference dataset: {args.reference}"""
    )

    app = create_app(
        primary_dataset_name=args.primary,
        reference_dataset_name=args.reference,
        debug=args.debug,
        graphiql=args.graphiql,
    )

    uvicorn.run(app, port=args.port)
