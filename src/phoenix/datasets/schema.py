import json
from dataclasses import asdict, dataclass, replace
from typing import Any, Dict, List, Optional, Tuple, Union

EmbeddingFeatures = Dict[str, "EmbeddingColumnNames"]
Relationships = Dict[str, "RelationshipColumnNames"]
SchemaFieldName = str
SchemaFieldValue = Union[
    Optional[str], Optional[List[str]], Optional[EmbeddingFeatures], Optional[Relationships]
]

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
class RelationshipColumnNames(Dict[str, Any]):
    """
    *** Experimental ***
    A relationship is a column that maps a prediction to another record.

    Example
    -------
    For example, in context retrieval from a vector store, a query is
    embedded and used to search for relevant records in a vector store.
    In this case you would add a column to the dataset that maps the query
    to the vector store records. E.x. [document_1, document_5, document_3]

    A table view of the primary dataset could look like this:

    | query |    document_ids       |
    |-------|-----------------------|
    | ...   | [doc_1, doc_5, doc_3] |
    | ...   | [doc_1, doc_6, doc_2] |
    | ...   | [doc_1, doc_6, doc_9] |


    The corresponding vector store dataset would look like this:

    | id | embedding_vector | document_text |
    |----------|--------|---------------|
    | doc_1    | ...    | lorem ipsum   |
    | doc_2    | ...    | lorem ipsum   |
    | doc_3    | ...    | lorem ipsum   |


    To declare this relationship in the schema, you would configure the schema as follows:

    >>> schema = Schema(
    ...     relationship_column_names={
    ...         "retrieval": RelationshipColumnNames(
    ...             ids_column_name="document_ids",
    ...         )
    """

    ids_column_name: str


@dataclass(frozen=True)
class Schema(Dict[SchemaFieldName, SchemaFieldValue]):
    prediction_id_column_name: Optional[str] = None
    timestamp_column_name: Optional[str] = None
    feature_column_names: Optional[List[str]] = None
    tag_column_names: Optional[List[str]] = None
    prediction_label_column_name: Optional[str] = None
    prediction_score_column_name: Optional[str] = None
    actual_label_column_name: Optional[str] = None
    actual_score_column_name: Optional[str] = None
    prompt_column_names: Optional[EmbeddingColumnNames] = None
    response_column_names: Optional[EmbeddingColumnNames] = None
    embedding_feature_column_names: Optional[EmbeddingFeatures] = None
    relationship_column_names: Optional[Relationships] = None
    excluded_column_names: Optional[List[str]] = None

    def replace(self, **changes: str) -> "Schema":
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

        # parse relationship_column_names
        if json_data.get("relationship_column_names") is not None:
            relationship_column_names = {}
            for relationship_name, column_names in json_data["relationship_column_names"].items():
                relationship_column_names[relationship_name] = RelationshipColumnNames(
                    ids_column_name=column_names["ids_column_name"],
                )
            json_data["relationship_column_names"] = relationship_column_names

        # parse prompt_column_names
        if json_data.get("prompt_column_names") is not None:
            prompt_column_names = EmbeddingColumnNames(
                vector_column_name=json_data["prompt_column_names"]["vector_column_name"],
                raw_data_column_name=json_data["prompt_column_names"]["raw_data_column_name"],
            )
            json_data["prompt_column_names"] = prompt_column_names

        # parse response_column_names
        if json_data.get("response_column_names") is not None:
            response_column_names = EmbeddingColumnNames(
                vector_column_name=json_data["response_column_names"]["vector_column_name"],
                raw_data_column_name=json_data["response_column_names"]["raw_data_column_name"],
            )
            json_data["response_column_names"] = response_column_names

        return cls(**json_data)
