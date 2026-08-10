"""Typed MCP result shapes for analytics SQL execution."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field, JsonValue

from phoenix.db.helpers import SupportedSQLDialectName
from phoenix.server.mcp_analytics_sql.errors import AnalyticsSqlError, ErrorCode


class AppliedSql(BaseModel):
    row_limit: int = Field(description="The limit in force for this call, after clamping.")
    dialect: SupportedSQLDialectName = Field(description="The SQL dialect used for this call.")
    rewrites: list[str] = Field(description="Server-side transforms that fired.")
    executed: Optional[str] = Field(
        default=None,
        description="The SQL executed when it differs from the caller's statement.",
        exclude_if=lambda value: value is None,
    )


class ExecuteSqlSuccessEnvelope(BaseModel):
    columns: list[str] = Field(
        description="Column names, in the order their values appear in each row."
    )
    rows: list[list[JsonValue]] = Field(
        description="One array of values per row, positionally aligned with `columns`."
    )
    row_count: int = Field(
        description="Rows returned, after any truncation to `applied.row_limit`."
    )
    row_count_is_partial: bool = Field(
        description=(
            "Whether rows were dropped. This is authoritative: one row beyond the limit is "
            "fetched, so a result of exactly row_limit rows is not assumed truncated."
        )
    )
    applied: AppliedSql = Field(
        description="The effective dialect, row limit, and server-side rewrites."
    )
    backend_validated: bool = Field(
        description="Whether the database backend's execution gate ran."
    )
    notes: list[str] = Field(
        description="Caveats about this answer that callers should not have to infer."
    )
    estimated_rows: Optional[int] = Field(
        default=None,
        description=(
            "The PostgreSQL planner's estimate of untruncated rows. It is not a count and "
            "never answers truncation; `row_count_is_partial` does."
        ),
        exclude_if=lambda value: value is None,
    )


class ExecuteSqlError(BaseModel):
    code: ErrorCode = Field(description="Machine-readable reason the statement was refused.")
    message: str = Field(description="Explanation of the refusal and any available correction.")
    identifiers: Optional[list[str]] = Field(
        default=None,
        description="Relations, columns, or functions involved in the refusal.",
        exclude_if=lambda value: value is None,
    )


class ExecuteSqlErrorEnvelope(BaseModel):
    error: ExecuteSqlError

    @classmethod
    def from_error(cls, error: AnalyticsSqlError) -> ExecuteSqlErrorEnvelope:
        return cls(
            error=ExecuteSqlError(
                code=error.code,
                message=error.message,
                identifiers=list(error.identifiers) or None,
            )
        )
