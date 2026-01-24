"""
GraphQL mutations for managing secrets (e.g., API keys, credentials).

Secrets are stored encrypted in the database and can be used to configure
provider integrations (e.g., OpenAI API keys). This module provides a single
unified mutation for upserting and deleting secrets in a single request.

Key features:
- Upsert semantics: Create new secrets or update existing ones by key
- Delete by setting value to None
- Batch operations: Multiple secrets can be processed in a single request
- Deduplication: When duplicate keys appear in the same request, the last value wins
- Encryption: Values are encrypted before storage using the configured encryption service
"""

import sqlalchemy as sa
import strawberry
from starlette.requests import Request
from strawberry import Info, field
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.api.auth import (
    IsAdminIfAuthEnabled,
    IsLocked,
    IsNotReadOnly,
    IsNotViewer,
)
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.queries import Query
from phoenix.server.api.types.Secret import Secret
from phoenix.server.bearer_auth import PhoenixUser


@strawberry.input
class SecretKeyValueInput:
    """
    Input type for a single secret key-value pair.

    Attributes:
        key: The unique identifier for the secret. Must be non-empty ASCII after trimming.
        value: The secret value. If None, the secret with this key will be deleted.
               If provided, must be non-empty after trimming.

    Example:
        # Create or update a secret
        {"key": "OPENAI_API_KEY", "value": "sk-..."}

        # Delete a secret
        {"key": "OPENAI_API_KEY", "value": null}
    """

    key: str
    value: str | None = field(
        description="The value of the secret. If null, the secret will be deleted."
    )

    def __post_init__(self) -> None:
        """Validate and normalize the key and value fields."""
        self.key = self.key.strip()
        if not self.key:
            raise BadRequest("Key cannot be empty")
        if not self.key.isascii():
            raise BadRequest("Key must be ASCII")
        if self.value is None:
            return
        self.value = self.value.strip()
        if not self.value:
            raise BadRequest("Value cannot be empty")


@strawberry.input
class UpsertOrDeleteSecretsMutationInput:
    """
    Input type for the upsertOrDeleteSecrets mutation.

    Attributes:
        secrets: A list of secret key-value pairs to upsert or delete.
                 Must contain at least one secret.

    Note:
        When the same key appears multiple times in the list, the last occurrence
        determines the final action (upsert with that value, or delete if value is null).
    """

    secrets: list[SecretKeyValueInput] = field(
        description="A list of secret key-value pairs to upsert or delete. "
        "Must contain at least one secret. When the same key appears multiple times in the list, "
        "the last occurrence determines the final action (upsert with that value, "
        "or delete if value is null)."
    )

    def __post_init__(self) -> None:
        """Validate that at least one secret is provided."""
        if not self.secrets:
            raise BadRequest("At least one secret is required")


@strawberry.type
class UpsertOrDeleteSecretsMutationPayload:
    """
    Payload returned by the upsertOrDeleteSecrets mutation.

    Attributes:
        upserted_secrets: List of secrets that were created or updated.
        deleted_ids: List of GlobalIDs for secrets that were deleted.
        query: The root query object for chaining additional queries.
    """

    upserted_secrets: list[Secret] = field(
        description="List of secrets that were created or updated."
    )
    deleted_ids: list[GlobalID] = field(
        description="List of GlobalIDs for secrets that were deleted."
    )
    query: Query


@strawberry.type
class SecretMutationMixin:
    """Mixin class providing secret management mutations."""

    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsAdminIfAuthEnabled, IsLocked]
    )  # type: ignore
    async def upsert_or_delete_secrets(
        self,
        info: Info[Context, None],
        input: UpsertOrDeleteSecretsMutationInput,
    ) -> UpsertOrDeleteSecretsMutationPayload:
        """
        Create, update, or delete secrets in a single atomic operation.

        This mutation processes a list of secret key-value pairs and performs:
        - Upsert (create or update) for secrets with non-null values
        - Hard delete for secrets with null values

        Args:
            info: GraphQL resolver info containing the request context.
            input: The mutation input containing the list of secrets to process.

        Returns:
            A payload containing:
            - upserted_secrets: Secrets that were created or updated
            - deleted_ids: GlobalIDs of secrets that were deleted
            - query: Root query object for chaining

        Note:
            - Duplicate keys are deduplicated by taking the last occurrence in the input list.
            - Deletions are idempotent (deleting a non-existent key succeeds silently).
            - Values are encrypted before storage.

        Permissions:
            - Requires write access (not read-only mode)
            - Requires non-viewer role
            - Requires admin role if authentication is enabled
            - Respects lock status
        """
        assert isinstance(request := info.context.request, Request)
        user_id: int | None = None
        if "user" in request.scope and isinstance((user := info.context.user), PhoenixUser):
            user_id = int(user.identity)

        dialect = SupportedSQLDialect(info.context.db.dialect.name)
        keys_to_delete: list[str] = []
        records_to_upsert: list[dict[str, object]] = []
        seen: set[str] = set()

        # Process in reverse order so that the last occurrence of a duplicate key wins.
        # This allows users to override earlier values in the same request.
        for secret_input in reversed(input.secrets):
            if (key := secret_input.key) in seen:
                continue
            seen.add(key)
            if secret_input.value is None:
                keys_to_delete.append(key)
            else:
                records_to_upsert.append(
                    dict(
                        key=key,
                        value=info.context.encrypt(secret_input.value.encode("utf-8")),
                        user_id=user_id,
                    )
                )

        # Execute database operations in a single transaction
        async with info.context.db() as session:
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

        deleted_ids = [GlobalID(type_name=Secret.__name__, node_id=key) for key in keys_to_delete]
        upserted_secrets = [Secret(id=str(record["key"])) for record in records_to_upsert]
        return UpsertOrDeleteSecretsMutationPayload(
            upserted_secrets=upserted_secrets,
            deleted_ids=deleted_ids,
            query=Query(),
        )
