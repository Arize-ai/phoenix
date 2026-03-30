"""
REST API endpoints for managing secrets (encrypted LLM provider credentials).

Secrets store encrypted API keys (e.g., OPENAI_API_KEY, ANTHROPIC_API_KEY) in the Phoenix
database. This module exposes a single PUT endpoint for batch upsert/delete operations.

Encryption/decryption is handled by Fernet (AES-128-CBC + HMAC-SHA256) derived from
the PHOENIX_SECRET environment variable. Secret values are never returned in responses.
"""

import sqlalchemy as sa
from fastapi import APIRouter, Depends, Request
from pydantic import Field, field_validator

from phoenix.db import models
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.api.helpers.secrets import normalize_secret_key
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.utils import ResponseBody, add_errors_to_responses
from phoenix.server.authorization import is_not_locked, require_admin
from phoenix.server.bearer_auth import PhoenixUser

router = APIRouter(tags=["secrets"])


class SecretKeyValue(V1RoutesBaseModel):
    """A single secret entry specifying a key and a required nullable value."""

    key: str
    value: str | None = Field(
        description=(
            "Provide a string to create or update the secret, or explicit null to delete it. "
            "This field is required; omitting it returns 422."
        )
    )

    @field_validator("key")
    @classmethod
    def validate_key(cls, v: str) -> str:
        """Keys must match ``[A-Za-z_][A-Za-z0-9_]*`` after trimming."""
        return normalize_secret_key(v)

    @field_validator("value")
    @classmethod
    def validate_value(cls, v: str | None) -> str | None:
        """Values, when non-null, must be non-empty strings (after trimming)."""
        if v is None:
            return None
        v = v.strip()
        if not v:
            raise ValueError("Value cannot be empty")
        return v


class UpsertOrDeleteSecretsRequest(V1RoutesBaseModel):
    """Request body for the PUT /secrets endpoint."""

    secrets: list[SecretKeyValue]

    @field_validator("secrets")
    @classmethod
    def validate_secrets(cls, v: list[SecretKeyValue]) -> list[SecretKeyValue]:
        """At least one secret entry is required."""
        if not v:
            raise ValueError("At least one secret is required")
        return v


class UpsertOrDeleteSecretsResult(V1RoutesBaseModel):
    """Result payload listing which keys were upserted and which were deleted."""

    upserted_keys: list[str]
    deleted_keys: list[str]


@router.put(
    "/secrets",
    operation_id="upsertOrDeleteSecrets",
    response_model=ResponseBody[UpsertOrDeleteSecretsResult],
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    dependencies=[Depends(require_admin), Depends(is_not_locked)],
    responses=add_errors_to_responses([422, 507]),
    summary="Upsert or delete secrets",
    description=(
        "Atomically upsert or delete a batch of secrets. "
        "Entries with a non-null `value` are created or updated; "
        "entries with `value: null` are deleted. "
        "The `value` field is required for every entry, and omitting it returns 422. "
        "When the same key appears more than once, the last occurrence wins. "
        "Deleting a non-existent key succeeds silently. "
        "Secret values are never returned in the response."
    ),
)
async def upsert_or_delete_secrets(
    request: Request,
    body: UpsertOrDeleteSecretsRequest,
) -> ResponseBody[UpsertOrDeleteSecretsResult]:
    """
    Upsert or delete secrets in a single atomic operation.

    Args:
        request: The incoming HTTP request (used to access app state).
        body: The request payload containing secrets to upsert or delete.

    Returns:
        A response body containing lists of upserted and deleted keys.
    """
    dialect = request.app.state.db.dialect
    encrypt = request.app.state.encrypt
    user_id: int | None = None
    if request.app.state.authentication_enabled and isinstance(request.user, PhoenixUser):
        user_id = int(request.user.identity)

    keys_to_delete: list[str] = []
    records_to_upsert: list[dict[str, object]] = []
    seen: set[str] = set()

    # Process in reverse so the last occurrence of a duplicate key wins.
    for entry in reversed(body.secrets):
        key = entry.key
        if key in seen:
            continue
        seen.add(key)
        if entry.value is None:
            keys_to_delete.append(key)
        else:
            records_to_upsert.append(
                {
                    "key": key,
                    "value": encrypt(entry.value.encode("utf-8")),
                    "user_id": user_id,
                }
            )

    async with request.app.state.db() as session:
        if keys_to_delete:
            await session.execute(
                sa.delete(models.Secret).where(models.Secret.key.in_(keys_to_delete))
            )
        if records_to_upsert:
            await session.execute(
                insert_on_conflict(
                    *records_to_upsert,
                    dialect=dialect,
                    table=models.Secret,
                    unique_by=("key",),
                    constraint_name="pk_secrets",
                    on_conflict=OnConflict.DO_UPDATE,
                )
            )

    upserted_keys = [str(r["key"]) for r in records_to_upsert]
    return ResponseBody(
        data=UpsertOrDeleteSecretsResult(
            upserted_keys=upserted_keys,
            deleted_keys=keys_to_delete,
        )
    )
