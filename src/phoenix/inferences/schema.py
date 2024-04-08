import json
from dataclasses import asdict, dataclass, replace
from typing import Any, Dict, List, Mapping, Optional, Tuple, Union

EmbeddingFeatures = Dict[str, "EmbeddingColumnNames"]
SchemaFieldName = str
SchemaFieldValue = Union[Optional[str], Optional[List[str]], Optional[EmbeddingFeatures]]

MULTI_COLUMN_SCHEMA_FIELD_NAMES: Tuple[str, ...] = ("feature_column_names", "tag_column_names")
SINGLE_COLUMN_SCHEMA_FIELD_NAMES: Tuple[str, ...] = (
    "prediction_id_column_name",
    "timestamp_column_name",
    "prediction_label_column_name",
    "prediction_score_column_name",
    "actual_label_column_name",
    "actual_score_column_name",
)
LLM_SCHEMA_FIELD_NAMES = ["prompt_column_names", "response_column_names"]


@dataclass(frozen=True)
class EmbeddingColumnNames(Dict[str, Any]):
    """
    A dataclass to hold the column names for the embedding features.
    An embedding feature is a feature that is represented by a vector.
    The vector is a representation of unstructured data, such as text or an image
    """

    vector_column_name: str
    raw_data_column_name: Optional[str] = None
    link_to_data_column_name: Optional[str] = None


@dataclass(frozen=True)
class RetrievalEmbeddingColumnNames(EmbeddingColumnNames):
    """
    A relationship is a column that maps a prediction to another record.

    Example
    -------
    For example, in context retrieval from a vector store, a query is
    embedded and used to search for relevant records in a vector store.
    In this case you would add a column to the dataset that maps the query
    to the vector store records. E.x. [document_1, document_5, document_3]

    A table view of the primary dataset could look like this:

    | query | retrieved_document_ids | document_relevance_scores |
    |-------|------------------------|---------------------------|
    | ...   | [doc_1, doc_5, doc_3]  | [0.4567, 0.3456, 0.2345]  |
    | ...   | [doc_1, doc_6, doc_2]  | [0.7890, 0.6789, 0.5678]  |
    | ...   | [doc_1, doc_6, doc_9]  | [0.9012, 0.8901, 0.0123]  |


    The corresponding vector store dataset would look like this:

    |    id    | embedding_vector | document_text |
    |----------|------------------|---------------|
    | doc_1    | ...              | lorem ipsum   |
    | doc_2    | ...              | lorem ipsum   |
    | doc_3    | ...              | lorem ipsum   |


    To declare this relationship in the schema, you would configure the schema as follows:

    >>> schema = Schema(
    ...     prompt_column_names=RetrievalEmbeddingColumnNames(
    ...         context_retrieval_ids_column_name="retrieved_document_ids",
    ...         context_retrieval_scores_column_name="document_relevance_scores",
    ...     )
    ...)
    """

    context_retrieval_ids_column_name: Optional[str] = None
    context_retrieval_scores_column_name: Optional[str] = None


@dataclass(frozen=True)
class Schema:
    prediction_id_column_name: Optional[str] = None
    id_column_name: Optional[str] = None  # Syntax sugar for prediction_id_column_name
    timestamp_column_name: Optional[str] = None
    feature_column_names: Optional[List[str]] = None
    tag_column_names: Optional[List[str]] = None
    prediction_label_column_name: Optional[str] = None
    prediction_score_column_name: Optional[str] = None
    actual_label_column_name: Optional[str] = None
    actual_score_column_name: Optional[str] = None
    prompt_column_names: Optional[Union[EmbeddingColumnNames, RetrievalEmbeddingColumnNames]] = None
    response_column_names: Optional[Union[str, EmbeddingColumnNames]] = None
    # document_column_names is used explicitly when the schema is used to capture a corpus
    document_column_names: Optional[EmbeddingColumnNames] = None
    embedding_feature_column_names: Optional[EmbeddingFeatures] = None
    excluded_column_names: Optional[List[str]] = None

    def __post_init__(self) -> None:
        # re-map document_column_names to be in the prompt_column_names position
        # This is a shortcut to leverage the same schema for model and corpus datasets
        if self.document_column_names is not None:
            object.__setattr__(self, "prompt_column_names", self.document_column_names)
            object.__setattr__(self, "document_column_names", None)

        if self.id_column_name is not None:
            object.__setattr__(self, "prediction_id_column_name", self.id_column_name)
            object.__setattr__(self, "id_column_name", None)

    def replace(self, **changes: Any) -> "Schema":
        return replace(self, **changes)

    def asdict(self) -> Dict[str, str]:
        return asdict(self)

    def to_json(self) -> str:
        "Converts the schema to a dict for JSON serialization"
        return json.dumps(asdict(self))

    @classmethod
    def from_json(cls, json_string: str) -> "Schema":
        json_data = json.loads(json_string)

        # parse embedding_feature_column_names
        if json_data.get("embedding_feature_column_names") is not None:
            embedding_feature_column_names = {}
            for feature_name, column_names in json_data["embedding_feature_column_names"].items():
                embedding_feature_column_names[feature_name] = EmbeddingColumnNames(
                    vector_column_name=column_names["vector_column_name"],
                    raw_data_column_name=column_names["raw_data_column_name"],
                    link_to_data_column_name=column_names["link_to_data_column_name"],
                )
            json_data["embedding_feature_column_names"] = embedding_feature_column_names

        # parse prompt_column_names
        if (prompt := json_data.get("prompt_column_names")) is not None:
            json_data["prompt_column_names"] = RetrievalEmbeddingColumnNames(
                vector_column_name=prompt.get("vector_column_name"),
                raw_data_column_name=prompt.get("raw_data_column_name"),
                context_retrieval_ids_column_name=prompt.get("context_retrieval_ids_column_name"),
                context_retrieval_scores_column_name=prompt.get(
                    "context_retrieval_scores_column_name"
                ),
            )

        # parse response_column_names
        if isinstance(json_data.get("response_column_names"), Mapping):
            response_column_names = EmbeddingColumnNames(
                vector_column_name=json_data["response_column_names"]["vector_column_name"],
                raw_data_column_name=json_data["response_column_names"]["raw_data_column_name"],
            )
            json_data["response_column_names"] = response_column_names

        return cls(**json_data)
