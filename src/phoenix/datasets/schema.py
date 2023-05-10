import json
from dataclasses import asdict, dataclass, replace
from typing import Any, Dict, List, Optional, Tuple, Union

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
    vector_column_name: str
    raw_data_column_name: Optional[str] = None
    link_to_data_column_name: Optional[str] = None


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
