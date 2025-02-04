from typing import Annotated, Any, Literal, Union

from jsonschema import Draft7Validator, ValidationError
from pydantic import AfterValidator, BaseModel, Field
from typing_extensions import TypeAlias

# This meta-schema describes valid JSON schemas according to the JSON Schema Draft 7 specification.
# It is copied from https://json-schema.org/draft-07/schema#
JSON_SCHEMA_DRAFT_7_META_SCHEMA = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "$id": "http://json-schema.org/draft-07/schema#",
    "title": "Core schema meta-schema",
    "definitions": {
        "schemaArray": {"type": "array", "minItems": 1, "items": {"$ref": "#"}},
        "nonNegativeInteger": {"type": "integer", "minimum": 0},
        "nonNegativeIntegerDefault0": {
            "allOf": [{"$ref": "#/definitions/nonNegativeInteger"}, {"default": 0}]
        },
        "simpleTypes": {
            "enum": ["array", "boolean", "integer", "null", "number", "object", "string"]
        },
        "stringArray": {
            "type": "array",
            "items": {"type": "string"},
            "uniqueItems": True,
            "default": [],
        },
    },
    "type": ["object", "boolean"],
    "properties": {
        "$id": {"type": "string", "format": "uri-reference"},
        "$schema": {"type": "string", "format": "uri"},
        "$ref": {"type": "string", "format": "uri-reference"},
        "$comment": {"type": "string"},
        "title": {"type": "string"},
        "description": {"type": "string"},
        "default": True,
        "readOnly": {"type": "boolean", "default": False},
        "writeOnly": {"type": "boolean", "default": False},
        "examples": {"type": "array", "items": True},
        "multipleOf": {"type": "number", "exclusiveMinimum": 0},
        "maximum": {"type": "number"},
        "exclusiveMaximum": {"type": "number"},
        "minimum": {"type": "number"},
        "exclusiveMinimum": {"type": "number"},
        "maxLength": {"$ref": "#/definitions/nonNegativeInteger"},
        "minLength": {"$ref": "#/definitions/nonNegativeIntegerDefault0"},
        "pattern": {"type": "string", "format": "regex"},
        "additionalItems": {"$ref": "#"},
        "items": {"anyOf": [{"$ref": "#"}, {"$ref": "#/definitions/schemaArray"}], "default": True},
        "maxItems": {"$ref": "#/definitions/nonNegativeInteger"},
        "minItems": {"$ref": "#/definitions/nonNegativeIntegerDefault0"},
        "uniqueItems": {"type": "boolean", "default": False},
        "contains": {"$ref": "#"},
        "maxProperties": {"$ref": "#/definitions/nonNegativeInteger"},
        "minProperties": {"$ref": "#/definitions/nonNegativeIntegerDefault0"},
        "required": {"$ref": "#/definitions/stringArray"},
        "additionalProperties": {"$ref": "#"},
        "definitions": {"type": "object", "additionalProperties": {"$ref": "#"}, "default": {}},
        "properties": {"type": "object", "additionalProperties": {"$ref": "#"}, "default": {}},
        "patternProperties": {
            "type": "object",
            "additionalProperties": {"$ref": "#"},
            "propertyNames": {"format": "regex"},
            "default": {},
        },
        "dependencies": {
            "type": "object",
            "additionalProperties": {
                "anyOf": [{"$ref": "#"}, {"$ref": "#/definitions/stringArray"}]
            },
        },
        "propertyNames": {"$ref": "#"},
        "const": True,
        "enum": {"type": "array", "items": True, "minItems": 1, "uniqueItems": True},
        "type": {
            "anyOf": [
                {"$ref": "#/definitions/simpleTypes"},
                {
                    "type": "array",
                    "items": {"$ref": "#/definitions/simpleTypes"},
                    "minItems": 1,
                    "uniqueItems": True,
                },
            ]
        },
        "format": {"type": "string"},
        "contentMediaType": {"type": "string"},
        "contentEncoding": {"type": "string"},
        "if": {"$ref": "#"},
        "then": {"$ref": "#"},
        "else": {"$ref": "#"},
        "allOf": {"$ref": "#/definitions/schemaArray"},
        "anyOf": {"$ref": "#/definitions/schemaArray"},
        "oneOf": {"$ref": "#/definitions/schemaArray"},
        "not": {"$ref": "#"},
    },
    "default": True,
}
Draft7Validator.check_schema(JSON_SCHEMA_DRAFT_7_META_SCHEMA)  # ensure the schema is valid
JSON_SCHEMA_DRAFT_7_VALIDATOR = Draft7Validator(JSON_SCHEMA_DRAFT_7_META_SCHEMA)


def validate_json_schema_draft_7_object(schema: dict[str, Any]) -> dict[str, Any]:
    """
    Validates that a dictionary is a valid JSON schema according to the JSON
    Schema Draft 7 specification.
    """
    try:
        JSON_SCHEMA_DRAFT_7_VALIDATOR.validate(schema)
    except ValidationError as error:
        raise ValueError(str(error))
    if schema.get("type") != "object":
        raise ValueError("The 'type' property must be 'object'")
    return schema


JSONSchemaDraft7ObjectSchemaContent: TypeAlias = Annotated[
    dict[str, Any],
    AfterValidator(validate_json_schema_draft_7_object),
]


class JSONSchemaDraft7ObjectSchema(BaseModel):
    type: Literal["json-schema-draft-7-object-schema"]
    content: JSONSchemaDraft7ObjectSchemaContent


JSONSchemaObjectSchema: TypeAlias = Annotated[
    Union[JSONSchemaDraft7ObjectSchema],
    Field(discriminator="type"),
]
