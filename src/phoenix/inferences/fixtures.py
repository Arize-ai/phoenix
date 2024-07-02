import json
import logging
from dataclasses import dataclass, replace
from enum import Enum, auto
from pathlib import Path
from typing import Iterator, NamedTuple, Optional, Tuple
from urllib import request
from urllib.parse import quote, urljoin

from pandas import read_parquet

from phoenix.config import INFERENCES_DIR
from phoenix.inferences.inferences import Inferences
from phoenix.inferences.schema import (
    EmbeddingColumnNames,
    RetrievalEmbeddingColumnNames,
    Schema,
)

logger = logging.getLogger(__name__)


class InferencesRole(Enum):
    PRIMARY = auto()
    REFERENCE = auto()
    CORPUS = auto()


@dataclass(frozen=True)
class Fixture:
    name: str
    description: str
    prefix: str
    primary_file_name: str
    primary_schema: Schema
    reference_file_name: Optional[str] = None
    # The schema for the reference dataset. If not provided, the primary schema will be used
    reference_schema: Optional[Schema] = None
    corpus_file_name: Optional[str] = None
    corpus_schema: Optional[Schema] = None

    def paths(self) -> Iterator[Tuple[InferencesRole, Path]]:
        return (
            (role, Path(self.prefix) / name)
            for role, name in zip(
                InferencesRole,
                (
                    self.primary_file_name,
                    self.reference_file_name,
                    self.corpus_file_name,
                ),
            )
            if name
        )


sentiment_classification_language_drift_schema = Schema(
    prediction_id_column_name="prediction_id",
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
    This  model takes online reviews of your U.S.-based product as the input and
    predicts whether the reviewer's sentiment was positive, negative, or
    neutral.

    You trained your sentiment classification model on English reviews. However,
    once the model was released into production, you notice that the performance
    of the model has degraded over a period of time.

    Phoenix is able to surface the reason for this performance degradation. In
    this example, the presence of reviews written in Spanish impact the model's
    performance. You can surface and troubleshoot this issue by analyzing the
    embedding vectors associated with the online review text.
    """,
    primary_schema=sentiment_classification_language_drift_schema,
    reference_schema=sentiment_classification_language_drift_schema,
    prefix="unstructured/nlp/sentiment-classification-language-drift",
    primary_file_name="sentiment_classification_language_drift_production.parquet",
    reference_file_name="sentiment_classification_language_drift_training.parquet",
)

image_classification_schema = Schema(
    timestamp_column_name="prediction_ts",
    prediction_label_column_name="predicted_action",
    actual_label_column_name="actual_action",
    embedding_feature_column_names={
        "image_embedding": EmbeddingColumnNames(
            vector_column_name="image_vector",
            link_to_data_column_name="url",
        ),
    },
)

image_classification_fixture = Fixture(
    name="image_classification",
    description="""
    Imagine you're in charge of maintaining a model that classifies the action
    of people in photographs. Your model initially performs well in production,
    but its performance gradually degrades over time.
    """,
    primary_schema=replace(image_classification_schema, actual_label_column_name=None),
    reference_schema=image_classification_schema,
    prefix="unstructured/cv/human-actions",
    primary_file_name="human_actions_production.parquet",
    reference_file_name="human_actions_training.parquet",
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
    Fashion-MNIST is a dataset of Zalando's article images consisting of a
    training set of 60,000 examples and a test set of 10,000 examples. Each
    example is a 28x28 grayscale image, associated with a label from 10 classes.
    Fashion-MNIST serves as a direct drop-in replacement for the original MNIST
    dataset for benchmarking machine learning algorithms. It shares the same
    image size and structure of training and testing splits.
    """,
    primary_schema=fashion_mnist_primary_schema,
    reference_schema=fashion_mnist_reference_schema,
    prefix="unstructured/cv/fashion-mnist",
    primary_file_name="fashion_mnist_production.parquet",
    reference_file_name="fashion_mnist_train.parquet",
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
    This simple model can automatically scan text, pull out some fundamental
    entities within it, and classify them into predefined categories: Person,
    Location, or Organization. However, once the model was released into
    production, you notice that the performance of the model has degraded over a
    period of time.

    Phoenix is able to surface the reason for this performance degradation. In
    this example, text including locations is under-represented in the training
    set. This label imbalance impacts the model's performance. You can surface
    and troubleshoot this issue by analyzing the embedding vectors associated
    with the input text.
    """,
    primary_schema=ner_token_drift_schema,
    reference_schema=ner_token_drift_schema,
    prefix="unstructured/nlp/named-entity-recognition",
    primary_file_name="ner_token_drift_production.parquet",
    reference_file_name="ner_token_drift_train.parquet",
)

credit_card_fraud_schema = Schema(
    prediction_id_column_name="prediction_id",
    prediction_label_column_name="predicted_label",
    prediction_score_column_name="predicted_score",
    actual_label_column_name="actual_label",
    timestamp_column_name="prediction_timestamp",
    tag_column_names=["age"],
    embedding_feature_column_names={
        "tabular_embedding": EmbeddingColumnNames(vector_column_name="tabular_vector"),
    },
)
credit_card_fraud_fixture = Fixture(
    name="credit_card_fraud",
    description="""
    Use-case for a credit card fraud detection model at a large bank or payment
    processing company.

    You have been alerted by a spike in credit card chargebacks leading you to
    suspect that fraudsters are getting away with committing fraud undetected!

    Realizing that this flaw in your model's performance has a heavy cost on
    your company and customers, you understand the need for a powerful tools to
    troubleshoot and prevent costly model degradations. You turn to Phoenix to
    find out what changed in your credit card fraud detection model and how you
    can improve it.
    """,
    primary_schema=credit_card_fraud_schema,
    reference_schema=credit_card_fraud_schema,
    prefix="structured/credit-card-fraud",
    primary_file_name="credit_card_fraud_production.parquet",
    reference_file_name="credit_card_fraud_train.parquet",
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
    Investigate various performance related aspects of an online advertisement
    use-case. These datasets are designed for analyzing Click-through Rate (CTR)
    performance.

    You manage the models for an online advertising platform. You have spent a
    great deal of your time collecting online data and training models for best
    performance. With your models now in production you have no tools available
    to your disposal to monitor the performance of your models, identify any
    issues, or get insights into how to improve your models.

    This use-case highlights a common advertisement use-case and is tailored for
    analyzing CTR for an ad or ad group.
    """,
    primary_schema=click_through_rate_schema,
    reference_schema=click_through_rate_schema,
    prefix="structured/click-through-rate",
    primary_file_name="click_through_rate_production.parquet",
    reference_file_name="click_through_rate_train.parquet",
)

chatbot_queries_schema = Schema(
    prediction_id_column_name="id",
    prompt_column_names=RetrievalEmbeddingColumnNames(
        vector_column_name="prompt",
        raw_data_column_name="prompt_text",
        context_retrieval_ids_column_name="document_ids",
        context_retrieval_scores_column_name="document_scores",
    ),
    response_column_names="response",
    tag_column_names=[
        "answer_relevancy",
        "context_relevancy",
        "faithfulness",
        "document_similarity_0",
        "document_similarity_1",
        "openai_relevance_0",
        "openai_relevance_1",
        "user_feedback",
    ],
)

chatbot_database_schema = Schema(
    prediction_id_column_name="document_id",
    prompt_column_names=EmbeddingColumnNames(
        vector_column_name="text_vector",
        raw_data_column_name="text",
    ),
)

chatbot_fixture = Fixture(
    name="chatbot",
    description="""
    Investigate RAG performance for a chatbot built on top of Arize's documentation.
    This use-case highlights how embedding visualizations for a RAG application can
    highlight issues with the application's retrieval and performance.

    The data contains relevance metrics generated by LLM Evals as well as RAGAS.
    """,
    primary_schema=chatbot_queries_schema,
    corpus_schema=chatbot_database_schema,
    prefix="unstructured/llm/chatbot",
    primary_file_name="chatbot_queries_with_ragas.parquet",
    corpus_file_name="chatbot_database_ds.parquet",
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
    Use-case that for a wide data model (e.g. a large amount of features). For
    developer use only.
    """,
    primary_schema=wide_data_primary_schema,
    reference_schema=wide_data_reference_schema,
    prefix="structured/wide-data",
    primary_file_name="wide_data_production.parquet",
    reference_file_name="wide_data_train.parquet",
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
    prefix="structured/deep-data",
    primary_file_name="deep_data_production.parquet",
    reference_file_name="deep_data_train.parquet",
)


llm_summarization_schema = Schema(
    timestamp_column_name="prediction_timestamp",
    tag_column_names=[
        "rougeL_score",
        "reference_summary",
    ],
    prompt_column_names=EmbeddingColumnNames(
        vector_column_name="article_vector", raw_data_column_name="article"
    ),
    response_column_names=EmbeddingColumnNames(
        vector_column_name="summary_vector", raw_data_column_name="summary"
    ),
)
llm_summarization_fixture = Fixture(
    name="llm_summarization",
    description="""
    LLM summarization data.
    """,
    primary_schema=llm_summarization_schema,
    reference_schema=llm_summarization_schema,
    prefix="unstructured/llm/summarization",
    primary_file_name="llm_summarization_prod.parquet",
    reference_file_name="llm_summarization_baseline.parquet",
)

wikipedia_fixture = Fixture(
    name="wiki",
    description="""
    Semantic search dataset including queries, answers, retrievals and corpus
    documents. Queries are sampled from Google’s Natural Questions dataset
    https://ai.google.com/research/NaturalQuestions, and documents (paragraphs)
    are sampled from http://sbert.net/datasets/simplewiki-2020-11-01.jsonl.gz,
    based on the Simple English Wikipedia. Embeddings for both questions and
    documents are generated from the bi-encoder 'multi-qa-MiniLM-L6-cos-v1',
    which produces normalized vectors that are 384-dimensional. Given a query
    and its embedding, a small subset of documents are first retrieved based on
    cosine similarity search on the document embeddings, then relevance scores
    are computed on the retrieved documents using the cross-encoder
    'cross-encoder/ms-marco-MiniLM-L-12-v2'. Answers (to the queries) are
    generated from 'deepset/tinyroberta-squad2' using the most relevant
    documents as the context input.

    References:
    - https://www.sbert.net/examples/applications/semantic-search/README.html
    - https://github.com/UKPLab/sentence-transformers/tree/master/examples/applications/retrieve_rerank
    - https://www.sbert.net/docs/pretrained_models.html
    - https://www.sbert.net/docs/pretrained_cross-encoders.html
    - https://ai.google.com/research/NaturalQuestions
    """,  # noqa: E501
    primary_schema=Schema(
        prediction_id_column_name="id",
        prompt_column_names=RetrievalEmbeddingColumnNames(
            vector_column_name="embedding",
            raw_data_column_name="question",
            context_retrieval_ids_column_name="retrievals",
            context_retrieval_scores_column_name="scores",
        ),
        response_column_names="answer",
    ),
    corpus_schema=Schema(
        id_column_name="id",
        document_column_names=EmbeddingColumnNames(
            vector_column_name="embedding",
            raw_data_column_name="text",
        ),
    ),
    prefix="unstructured/search/wiki",
    primary_file_name="queries.parquet",
    # The reference file is intended purely for troubleshooting bad data. Un-comment for testing.
    # reference_file_name="queries2.parquet",
    corpus_file_name="corpus.parquet",
)

FIXTURES: Tuple[Fixture, ...] = (
    sentiment_classification_language_drift_fixture,
    image_classification_fixture,
    fashion_mnist_fixture,
    ner_token_drift_fixture,
    credit_card_fraud_fixture,
    click_through_rate_fixture,
    wide_data_fixture,
    deep_data_fixture,
    llm_summarization_fixture,
    wikipedia_fixture,
    chatbot_fixture,
)
NAME_TO_FIXTURE = {fixture.name: fixture for fixture in FIXTURES}


def get_inferences(
    fixture_name: str,
    no_internet: bool = False,
) -> Tuple[Inferences, Optional[Inferences], Optional[Inferences]]:
    """
    Downloads primary and reference inferences for a fixture if they are not found
    locally.
    """
    fixture = _get_fixture_by_name(fixture_name=fixture_name)
    if no_internet:
        paths = {role: INFERENCES_DIR / path for role, path in fixture.paths()}
    else:
        paths = dict(_download(fixture, INFERENCES_DIR))
    primary_inferences = Inferences(
        read_parquet(paths[InferencesRole.PRIMARY]),
        fixture.primary_schema,
        "production",
    )
    reference_inferences = None
    if fixture.reference_file_name is not None:
        reference_inferences = Inferences(
            read_parquet(paths[InferencesRole.REFERENCE]),
            fixture.reference_schema
            if fixture.reference_schema is not None
            else fixture.primary_schema,
            "training",
        )
    corpus_inferences = None
    if fixture.corpus_file_name is not None:
        corpus_inferences = Inferences(
            read_parquet(paths[InferencesRole.CORPUS]),
            fixture.corpus_schema,
            "knowledge_base",
        )
    return primary_inferences, reference_inferences, corpus_inferences


def _get_fixture_by_name(fixture_name: str) -> Fixture:
    """
    Returns the fixture whose name matches the input name. Raises a ValueError
    if the input fixture name does not match any known fixture names.
    """
    if fixture_name not in NAME_TO_FIXTURE:
        valid_fixture_names = ", ".join(NAME_TO_FIXTURE.keys())
        raise ValueError(f'"{fixture_name}" is invalid. Valid names are: {valid_fixture_names}')
    return NAME_TO_FIXTURE[fixture_name]


@dataclass
class ExampleInferences:
    """
    A primary and optional reference dataset pair.
    """

    primary: Inferences
    reference: Optional[Inferences] = None
    corpus: Optional[Inferences] = None


def load_example(use_case: str) -> ExampleInferences:
    """
    Loads an example primary and reference dataset for a given use-case.

    Parameters
    ----------
        use_case: str
            Name of the phoenix supported use case Valid values include:
                - "sentiment_classification_language_drift"
                - "image_classification"
                - "fashion_mnist"
                - "ner_token_drift"
                - "credit_card_fraud"
                - "click_through_rate"


    Returns
    _______
        datasets: DatasetDict
            A dictionary of datasets, split out by dataset type (primary,
            reference).

    """
    fixture = _get_fixture_by_name(use_case)
    primary_inferences, reference_inferences, corpus_inferences = get_inferences(use_case)
    print(f"📥 Loaded {use_case} example datasets.")
    print("ℹ️ About this use-case:")
    print(fixture.description)
    return ExampleInferences(
        primary=primary_inferences,
        reference=reference_inferences,
        corpus=corpus_inferences,
    )


class Metadata(NamedTuple):
    path: str
    mediaLink: str
    md5Hash: str

    def save_artifact(self, location: Path) -> Path:
        data_file_path = location / self.path
        md5_file = data_file_path.with_name(data_file_path.stem + ".md5")
        data_file_path.parents[0].mkdir(parents=True, exist_ok=True)
        if data_file_path.is_file() and md5_file.is_file():
            with open(md5_file, "r") as f:
                if f.readline() == self.md5Hash:
                    return data_file_path
        request.urlretrieve(self.mediaLink, data_file_path)
        with open(md5_file, "w") as f:
            f.write(self.md5Hash)
        return data_file_path


class GCSAssets(NamedTuple):
    host: str = "https://storage.googleapis.com/"
    bucket: str = "arize-assets"
    prefix: str = "phoenix/datasets/"

    def metadata(self, path: Path) -> Metadata:
        url = urljoin(
            urljoin(self.host, f"storage/v1/b/{self.bucket}/o/"),
            quote(urljoin(self.prefix, str(path)), safe=""),
        )
        resp = json.loads(request.urlopen(request.Request(url)).read())
        return Metadata(
            resp["name"][len(self.prefix) :],
            resp["mediaLink"],
            resp["md5Hash"],
        )


def _download(fixture: Fixture, location: Path) -> Iterator[Tuple[InferencesRole, Path]]:
    for role, path in fixture.paths():
        yield role, GCSAssets().metadata(path).save_artifact(location)


# Download all fixtures
if __name__ == "__main__":
    import time

    for fixture in FIXTURES:
        start_time = time.time()
        print(f"getting {fixture.name}", end="...")
        dict(_download(fixture, INFERENCES_DIR))
        print(f"done ({time.time() - start_time:.2f}s)")
