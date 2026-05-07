from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ToolExpectation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    required: list[str] = Field(default_factory=list)
    forbidden: list[str] = Field(default_factory=list)


class ExampleExpected(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    tools: ToolExpectation
    tool_call_args: dict[str, dict[str, Any]] = Field(default_factory=dict)


class ExampleInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str


class DatasetExample(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    input: ExampleInput
    expected: ExampleExpected
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("id")
    @classmethod
    def _id_not_empty(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("example id cannot be empty")
        return value


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
        ids = [example.id for example in self.examples]
        duplicates = sorted({example_id for example_id in ids if ids.count(example_id) > 1})
        if duplicates:
            raise ValueError(f"duplicate example ids: {', '.join(duplicates)}")
        return self


class ToolCall(BaseModel):
    model_config = ConfigDict(extra="allow")

    name: str
    args: dict[str, Any] = Field(default_factory=dict)


class AgentTaskOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assistant_text: str | None = None
    tool_calls: list[ToolCall] = Field(default_factory=list)
    messages: list[dict[str, Any]] = Field(default_factory=list)
    raw_output_type: str
    error: str | None = None
