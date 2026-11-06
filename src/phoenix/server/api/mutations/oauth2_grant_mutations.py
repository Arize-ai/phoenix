from datetime import datetime, timezone

import strawberry
from sqlalchemy import select
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.auth import IsLocked, IsNotReadOnly
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import NotFound, Unauthorized
from phoenix.server.api.queries import Query
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.OAuth2Grant import OAuth2Grant, can_manage_grant
from phoenix.server.types import AccessTokenId, RefreshTokenId


@strawberry.input
class RevokeOAuth2GrantInput:
    id: GlobalID


@strawberry.type
class RevokeOAuth2GrantMutationPayload:
    grant_id: GlobalID
    query: Query


@strawberry.type
class OAuth2GrantMutationMixin:
    @strawberry.mutation(  # type: ignore
        name="revokeOAuth2Grant",
        permission_classes=[IsNotReadOnly, IsLocked],
    )
    async def revoke_oauth2_grant(
        self, info: Info[Context, None], input: RevokeOAuth2GrantInput
    ) -> RevokeOAuth2GrantMutationPayload:
        assert (token_store := info.context.token_store) is not None
        grant_id = from_global_id_with_expected_type(
            input.id, expected_type_name=OAuth2Grant.__name__
        )
        refresh_token_ids: list[RefreshTokenId] = []
        access_token_ids: list[AccessTokenId] = []
        async with info.context.db() as session:
            grant = await session.scalar(
                select(models.OAuth2Grant).where(models.OAuth2Grant.id == grant_id)
            )
            if grant is None:
                raise NotFound(f"OAuth2 grant with id {input.id} not found")
            if not can_manage_grant(info, grant.user_id):
                raise Unauthorized("User not authorized to revoke OAuth2 grant")

            grant.revoked_at = datetime.now(timezone.utc)
            token_rows = await session.execute(
                select(models.RefreshToken.id, models.AccessToken.id)
                .select_from(models.RefreshToken)
                .join(
                    models.AccessToken,
                    models.AccessToken.refresh_token_id == models.RefreshToken.id,
                    isouter=True,
                )
                .where(models.RefreshToken.oauth2_grant_id == grant_id)
            )
            for refresh_token_id, access_token_id in token_rows:
                refresh_token_ids.append(RefreshTokenId(refresh_token_id))
                if access_token_id is not None:
                    access_token_ids.append(AccessTokenId(access_token_id))

        await token_store.revoke(*refresh_token_ids, *access_token_ids)
        return RevokeOAuth2GrantMutationPayload(grant_id=input.id, query=Query())
