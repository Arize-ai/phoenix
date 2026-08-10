from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class ErrorCode(str, Enum):
    INVALID_ARGUMENT = "invalid_argument"
    PARSE_ERROR = "parse_error"
    UNSUPPORTED_SYNTAX = "unsupported_syntax"
    MULTI_STATEMENT = "multi_statement"
    NOT_READ_ONLY = "not_read_only"
    RELATION_NOT_ALLOWED = "relation_not_allowed"
    COLUMN_NOT_ALLOWED = "column_not_allowed"
    FUNCTION_NOT_ALLOWED = "function_not_allowed"
    OPERATOR_NOT_ALLOWED = "operator_not_allowed"
    PLAN_VERIFICATION_FAILED = "plan_verification_failed"
    TIMEOUT = "timeout"
    RATE_LIMITED = "rate_limited"
    QUEUE_FULL = "queue_full"
    SCHEMA_MANIFEST_MISMATCH = "schema_manifest_mismatch"
    RESULT_VALUE_TOO_LARGE = "result_value_too_large"
    BACKEND_UNAVAILABLE = "backend_unavailable"
    EXECUTION_ERROR = "execution_error"


@dataclass(frozen=True)
class AnalyticsSqlError(Exception):
    code: ErrorCode
    message: str
    identifiers: tuple[str, ...] = ()
    admission_detail: str = ""


# The spelling that answers the same question on the backend where the refused
# one does not exist. A refusal a caller cannot act on costs them a round trip
# to discover something we already knew: these are not missing capabilities,
# they are the same capability under another name, and the surface allows both.
#
# Only entries where the two genuinely compute the same statistic belong here.
# Suggesting a near neighbour would be worse than saying nothing, because a
# caller who takes the suggestion gets a plausible answer to a different
# question.
_EQUIVALENT: dict[str, str] = {
    # Ordered-set aggregate on PostgreSQL; SQLite reaches the same statistic
    # through a plain call from the bundled stats extension. Their agreement
    # across nulls, empty input, single rows and the range extremes is asserted
    # in test_percentile_parity.py, which is what makes this safe to suggest.
    "percentile_cont": "percentile(x, p)",
    "percentile": "percentile_cont(p) WITHIN GROUP (ORDER BY x)",
}


def admission_error_from_outcome(
    outcome: str, detail: str = "", *, message: str = ""
) -> AnalyticsSqlError:
    code = ErrorCode(outcome)
    messages = {
        ErrorCode.PARSE_ERROR: "SQL could not be parsed.",
        ErrorCode.UNSUPPORTED_SYNTAX: detail or "Unsupported SQL syntax.",
        ErrorCode.MULTI_STATEMENT: "Only one SQL statement is supported.",
        ErrorCode.NOT_READ_ONLY: detail or "Only read-only SELECT is supported.",
        ErrorCode.RELATION_NOT_ALLOWED: f"Table {detail} is not available for analytics SQL.",
        # Names the column rather than reporting it missing. It is in the real
        # schema, so a caller told "no such column" retries the spellings it
        # thinks are near it; told the column exists and was left out, it stops.
        #
        # This wording is for a column the schema withholds. A column that does
        # not exist reaches the same outcome and must not get this sentence:
        # told a typo "exists and was left out", a caller stops -- when trying
        # the spelling it meant is exactly what it should do. Callers that
        # refuse an unknown column supply their own message.
        #
        # Left out for being uninformative, not for being secret: these are
        # display attributes and foreign keys to tables this surface does not
        # expose, so they answer no analytical question. Anything genuinely
        # restricted is absent from the allowlist entirely, and everything here
        # is readable through the GraphQL API by the same caller.
        ErrorCode.COLUMN_NOT_ALLOWED: (
            f"Column {detail} exists but is not part of the analytics schema, "
            "because it answers no analytical question. Use describeSqlSchema "
            "to see the columns that are."
        ),
        ErrorCode.FUNCTION_NOT_ALLOWED: (
            f"Function {detail} is not allowed."
            + (f" On this backend, use {alt}." if (alt := _EQUIVALENT.get(detail.lower())) else "")
        ),
    }
    identifiers: tuple[str, ...] = ()
    if code in (ErrorCode.RELATION_NOT_ALLOWED, ErrorCode.COLUMN_NOT_ALLOWED) and detail:
        identifiers = (detail.strip("'"),)
    elif code is ErrorCode.FUNCTION_NOT_ALLOWED and detail:
        identifiers = (detail,)
    return AnalyticsSqlError(
        code=code,
        message=message or messages.get(code, detail or code.value),
        identifiers=identifiers,
        admission_detail=detail,
    )
