import json
from dataclasses import dataclass, fields
from typing import Any, Dict, List, Optional, Tuple, Union

from typing_extensions import TypeGuard

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
        inner_lines = []
        for field in fields(self):
            field_name = field.name
            field_value = getattr(self, field.name)
            lines_for_field: List[str] = []
            if field_value is None:
                continue
            elif isinstance(field_value, str):
                lines_for_field.append(
                    _get_line_for_field_with_string_value(field_name, field_value)
                )
            elif _is_list_of_strings(field_value):
                lines_for_field = _get_lines_for_field_with_list_value(field_name, field_value)
            elif _is_embedding_feature(field_value):
                lines_for_field = _get_lines_for_field_with_embedding_features_value(
                    field_name, field_value
                )
            else:
                lines_for_field = _get_lines_for_field_with_unrecognized_value(
                    field_name, field_value
                )
            lines_for_field = [_TAB + line for line in lines_for_field]
            inner_lines.extend(lines_for_field)
        inner_args_string = "\n".join(inner_lines)
        if inner_args_string:
            inner_args_string = "\n" + inner_args_string + "\n"
        repr_string = f"{self.__class__.__name__}({inner_args_string})"
        return repr_string


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


def _get_line_for_field_with_string_value(field_name: str, field_value: str) -> str:
    """
    Return a line that represents a field set to a string value.
    """
    return f"{field_name}='{field_value}',"


def _get_lines_for_field_with_list_value(field_name: str, field_value: List[str]) -> List[str]:
    """
    Get lines that represent a field set to a list of string values.
    """
    lines_for_field = [f"{field_name}=["]
    for entry in field_value:
        lines_for_field.append(f"{_TAB}'{entry}',")
    lines_for_field.append("],")
    return lines_for_field


def _get_lines_for_field_with_embedding_features_value(
    field_name: str, field_value: EmbeddingFeatures
) -> List[str]:
    """
    Get lines that represent a field set to a dictionary representing embedding features.
    """
    lines = [f"{field_name}={{"]
    for key, value in field_value.items():
        lines_for_value = repr(value).split("\n")
        lines_for_value[0] = f"'{key}': {lines_for_value[0]}"
        lines_for_value[-1] = lines_for_value[-1] + ","
        lines_for_value = [_TAB + line for line in lines_for_value]
        lines.extend(lines_for_value)
    lines.append("},")
    return lines


def _get_lines_for_field_with_unrecognized_value(field_name: str, field_value: Any) -> List[str]:
    """
    Get lines that represent a field being set to an unrecognized object.
    """
    lines = repr(field_value).split("\n")
    lines[0] = f"{field_name}={lines[0]}"
    lines[-1] = lines[-1] + ","
    lines[1:] = [" " * (len(field_name) + 1) + line for line in lines[1:]]
    return lines


def _is_list_of_strings(value: Any) -> TypeGuard[List[str]]:
    """
    A type guard for lists of strings.
    """
    return isinstance(value, list) and all(isinstance(item, str) for item in value)


def _is_embedding_feature(value: Any) -> TypeGuard[EmbeddingFeatures]:
    """
    A type guard for embedding features.
    """
    return isinstance(value, dict) and all(
        isinstance(key, str) and isinstance(val, EmbeddingColumnNames) for key, val in value.items()
    )
