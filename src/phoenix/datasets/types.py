from dataclasses import dataclass
from typing import Dict, List, NamedTuple, Optional, TypedDict
import json


class EmbeddingColumnNamesDict(TypedDict):
    vector_column_name: str
    raw_data_column_name: Optional[str]
    link_to_data_column_name: Optional[str]


class EmbeddingColumnNames(NamedTuple):
    vector_column_name: str
    raw_data_column_name: Optional[str] = None
    link_to_data_column_name: Optional[str] = None

    def to_dict(self) -> EmbeddingColumnNamesDict:
        dictionary: EmbeddingColumnNamesDict = {
            "vector_column_name": self.vector_column_name,
            "raw_data_column_name": self.raw_data_column_name,
            "link_to_data_column_name": self.link_to_data_column_name,
        }
        return dictionary


class SchemaDict(TypedDict):
    prediction_id_column_name: Optional[str]
    timestamp_column_name: Optional[str]
    feature_column_names: Optional[List[str]]
    prediction_label_column_name: Optional[str]
    prediction_score_column_name: Optional[str]
    actual_label_column_name: Optional[str]
    actual_score_column_name: Optional[str]
    embedding_feature_column_names: Optional[Dict[str, EmbeddingColumnNamesDict]]


@dataclass(frozen=True)
class Schema:
    prediction_id_column_name: Optional[str] = None
    timestamp_column_name: Optional[str] = None
    feature_column_names: Optional[List[str]] = None
    prediction_label_column_name: Optional[str] = None
    prediction_score_column_name: Optional[str] = None
    actual_label_column_name: Optional[str] = None
    actual_score_column_name: Optional[str] = None
    embedding_feature_column_names: Optional[Dict[str, EmbeddingColumnNames]] = None

    def to_dict(self) -> SchemaDict:
        """Converts the schema to a dict for JSON serialization"""
        dictionary: SchemaDict = {
            "prediction_id_column_name": None,
            "timestamp_column_name": None,
            "feature_column_names": None,
            "prediction_label_column_name": None,
            "prediction_score_column_name": None,
            "actual_label_column_name": None,
            "actual_score_column_name": None,
            "embedding_feature_column_names": None,
        }

        for field in self.__dataclass_fields__:
            value = getattr(self, field)
            if (
                field is "embedding_feature_column_names"
                and self.embedding_feature_column_names is not None
            ):
                embedding_feature_column_names = {}
                for item in self.embedding_feature_column_names.items():
                    embedding_feature_column_names[item[0]] = item[1].to_dict()
                json_value = embedding_feature_column_names

            else:
                json_value = value

            dictionary[str(field)] = json_value
        return dictionary

    def to_json(self) -> str:
        return json.dumps(self.to_dict())
