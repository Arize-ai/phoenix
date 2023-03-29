import json
from dataclasses import dataclass
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
    embedding_feature_column_names: Optional[EmbeddingFeatures] = None
    excluded_column_names: Optional[List[str]] = None

    def to_json(self) -> str:
        "Converts the schema to a dict for JSON serialization"
        dictionary = {}

        for field in self.__dataclass_fields__:
            value = getattr(self, field)
            if (
                field == "embedding_feature_column_names"
                and self.embedding_feature_column_names is not None
            ):
                embedding_feature_column_names = {}
                for item in self.embedding_feature_column_names.items():
                    embedding_feature_column_names[item[0]] = item[1].__dict__
                json_value = embedding_feature_column_names

            else:
                json_value = value

            dictionary[str(field)] = json_value
        return json.dumps(dictionary)

    @classmethod
    def from_json(cls, json_string: str) -> "Schema":
        json_data = json.loads(json_string)

        # parse embedding_feature_column_names
        if json_data["embedding_feature_column_names"] is not None:
            embedding_feature_column_names = {}
            for feature_name, column_names in json_data["embedding_feature_column_names"].items():
                embedding_feature_column_names[feature_name] = EmbeddingColumnNames(
                    vector_column_name=column_names["vector_column_name"],
                    raw_data_column_name=column_names["raw_data_column_name"],
                    link_to_data_column_name=column_names["link_to_data_column_name"],
                )
            json_data["embedding_feature_column_names"] = embedding_feature_column_names
        return cls(**json_data)
