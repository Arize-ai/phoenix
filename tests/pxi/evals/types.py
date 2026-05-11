from __future__ import annotations

from pydantic import BaseModel, ConfigDict, field_validator, model_validator
from typing_extensions import NotRequired, TypeAlias, TypedDict

JsonValue: TypeAlias = str | int | float | bool | None | list[object] | dict[str, object]
JsonObject: TypeAlias = dict[str, object]


class ExampleInput(TypedDict):
    query: str


class DatasetExample(TypedDict):
    id: str
    input: ExampleInput
    expected: JsonObject
    metadata: NotRequired[JsonObject]


class PhoenixExample(TypedDict):
    id: str
    input: ExampleInput
    output: JsonObject
    metadata: JsonObject


class ToolCall(TypedDict):
    name: str
    args: JsonObject


class AgentTaskOutput(TypedDict, total=False):
    assistant_text: str | None
    tool_calls: list[ToolCall]
    messages: list[JsonObject]
    raw_output_type: str
    error: str
    stable_example_id: str


class EvalDataset(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dataset_name: str
    description: str | None = None
    examples: list[DatasetExample]

    @field_validator("dataset_name")
    @classmethod
    def _dataset_name_not_empty(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("dataset_name cannot be empty")
        return value

    @model_validator(mode="after")
    def _validate_examples(self) -> "EvalDataset":
        if not self.examples:
            raise ValueError("dataset must contain at least one example")
        ids: list[str] = []
        for index, example in enumerate(self.examples):
            if not isinstance(example, dict):
                raise ValueError(f"example {index} must be an object")
            example_id = example.get("id")
            if not isinstance(example_id, str) or not example_id.strip():
                raise ValueError(f"example {index} id cannot be empty")
            ids.append(example_id)
            input_value = example.get("input")
            if not isinstance(input_value, dict) or not isinstance(input_value.get("query"), str):
                raise ValueError(f"example {example_id} must define input.query")
            expected = example.get("expected")
            if not isinstance(expected, dict):
                raise ValueError(f"example {example_id} must define expected")
            tools = expected.get("tools")
            if not isinstance(tools, dict):
                raise ValueError(f"example {example_id} must define expected.tools")
            metadata = example.setdefault("metadata", {})
            if not isinstance(metadata, dict):
                raise ValueError(f"example {example_id} metadata must be an object")
        duplicates = sorted({example_id for example_id in ids if ids.count(example_id) > 1})
        if duplicates:
            raise ValueError(f"duplicate example ids: {', '.join(duplicates)}")
        return self
