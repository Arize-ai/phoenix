import json
from dataclasses import dataclass, fields
from typing import Dict, List, Optional, Tuple, Union

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

_TAB = " " * 4


@dataclass(frozen=True, repr=False)
class Viewable:
    """
    Mixin class that implements a __repr__ to produce output that a user can
    copy and paste in order to instantiate the represented dataclass instance.

    When inheriting from this class, ensure that the child dataclass has frozen
    set to true and repr set to false.
    """

    def __repr__(self) -> str:
        """
        This repr method produces output that a user can copy and paste to instantiate the dataclass
        """
        argument_strings = []
        schema_field_name_to_value = {
            field.name: field_value
            for field in fields(self)
            if (field_value := getattr(self, field.name)) is not None
        }
        for index, (field_name, field_value) in enumerate(schema_field_name_to_value.items()):
            if isinstance(field_value, str):
                arguments = [f'{field_name}="{field_value}",']
            elif isinstance(field_value, list):
                arguments = [f"{field_name}=["]
                for entry in field_value:
                    arguments.append(f'{_TAB}"{entry}",')
                arguments.append("],")
            elif isinstance(field_value, dict):
                arguments = [f"{field_name}={{"]
                for key, value in field_value.items():
                    value_lines = repr(value).split("\n")
                    value_lines[0] = f'"{key}": {value_lines[0]}'
                    value_lines[-1] = value_lines[-1] + ","
                    value_lines = [_TAB + vl for vl in value_lines]
                    arguments.extend(value_lines)
                arguments.append("},")
            else:
                raise ValueError(f"Encountered valid field value of type {type(field_value)}.")
            arguments = [_TAB + arg for arg in arguments]
            argument_strings.extend(arguments)
        schema_argument_string = "\n".join(argument_strings)
        if schema_argument_string:
            schema_argument_string = "\n" + schema_argument_string + "\n"
        return f"{self.__class__.__name__}({schema_argument_string})"


@dataclass(frozen=True, repr=False)
class EmbeddingColumnNames(Viewable, Dict[str, Optional[str]]):
    vector_column_name: str
    raw_data_column_name: Optional[str] = None
    link_to_data_column_name: Optional[str] = None


@dataclass(frozen=True, repr=False)
class Schema(Viewable, Dict[SchemaFieldName, SchemaFieldValue]):
    prediction_id_column_name: Optional[str] = None
    timestamp_column_name: Optional[str] = None
    feature_column_names: Optional[List[str]] = None
    tag_column_names: Optional[List[str]] = None
    prediction_label_column_name: Optional[str] = None
    prediction_score_column_name: Optional[str] = None
    actual_label_column_name: Optional[str] = None
    actual_score_column_name: Optional[str] = None
    embedding_feature_column_names: Optional[EmbeddingFeatures] = None
    excludes: Optional[List[str]] = None

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
