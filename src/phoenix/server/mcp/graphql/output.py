"""Typed MCP result shapes for GraphQL execution."""

from __future__ import annotations

from typing import Optional, Union

from pydantic import BaseModel, Field, JsonValue

from phoenix.server.api.graphql_execute import GraphQLRefusal, GraphQLRefusalCode


class ExecuteGraphqlResultEnvelope(BaseModel):
    """An operation that ran, in the shape the GraphQL specification defines.

    Both fields can be populated at once: GraphQL resolves each field
    independently, so a partial failure returns the fields that succeeded
    alongside the errors for those that did not.
    """

    data: Optional[dict[str, JsonValue]] = Field(
        description="The operation's result, or null when execution failed outright."
    )
    errors: list[dict[str, JsonValue]] = Field(
        default_factory=list,
        description=(
            "Field-level errors, each with `message` and usually `path`. A non-empty list "
            "alongside non-null `data` means the operation partially succeeded."
        ),
    )


class ExecuteGraphqlError(BaseModel):
    code: GraphQLRefusalCode = Field(
        description="Machine-readable reason the operation was refused."
    )
    message: str = Field(description="Explanation of the refusal and any available correction.")


class ExecuteGraphqlErrorEnvelope(BaseModel):
    """An operation that never ran.

    Distinct from an `errors` list, which reports what happened during
    execution. Here nothing executed, so no resolver ran and no state changed.
    """

    error: ExecuteGraphqlError

    @classmethod
    def from_refusal(cls, refusal: GraphQLRefusal) -> ExecuteGraphqlErrorEnvelope:
        return cls(error=ExecuteGraphqlError(code=refusal.code, message=refusal.message))


class ValidateGraphqlEnvelope(BaseModel):
    """The outcome of checking an operation without running it."""

    valid: bool = Field(description="Whether the document typechecks against the schema.")
    notes: list[str] = Field(description="Caveats about what this answer does and does not cover.")


ExecuteGraphqlOutput = Union[ExecuteGraphqlResultEnvelope, ExecuteGraphqlErrorEnvelope]
