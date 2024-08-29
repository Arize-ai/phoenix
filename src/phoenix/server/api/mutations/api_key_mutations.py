from datetime import datetime
from typing import Any, Dict, Optional

import jwt
import strawberry
from sqlalchemy import insert, select
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import NotFound
from phoenix.server.api.mutations.auth import HasSecret, IsAuthenticated
from phoenix.server.api.queries import Query
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.SystemApiKey import SystemApiKey


@strawberry.type
class CreateSystemApiKeyMutationPayload:
    jwt: str
    api_key: SystemApiKey
    query: Query


@strawberry.input
class CreateApiKeyInput:
    name: str
    description: Optional[str] = UNSET
    expires_at: Optional[datetime] = UNSET


@strawberry.input
class DeleteApiKeyInput:
    id: GlobalID


@strawberry.type
class DeleteSystemApiKeyMutationPayload:
    id: GlobalID
    query: Query


@strawberry.type
class ApiKeyMutationMixin:
    @strawberry.mutation(permission_classes=[HasSecret, IsAuthenticated])  # type: ignore
    async def create_system_api_key(
        self, info: Info[Context, None], input: CreateApiKeyInput
    ) -> CreateSystemApiKeyMutationPayload:
        # TODO(auth): safe guard against auth being disabled and secret not being set
        async with info.context.db() as session:
            # Get the system user - note this could be pushed into a dataloader
            system_user = await session.scalar(
                select(models.User)
                .join(models.UserRole)  # Join User with UserRole
                .where(models.UserRole.name == "SYSTEM")  # Filter where role is SYSTEM
                .limit(1)
            )
            if system_user is None:
                raise ValueError("System user not found")

            insert_stmt = (
                insert(models.APIKey)
                .values(
                    user_id=system_user.id,
                    name=input.name,
                    description=input.description or None,
                    expires_at=input.expires_at or None,
                )
                .returning(models.APIKey)
            )
            api_key = await session.scalar(insert_stmt)
            assert api_key is not None

        encoded_jwt = create_jwt(
            secret=info.context.get_secret(),
            name=api_key.name,
            id=api_key.id,
            description=api_key.description,
            iat=api_key.created_at,
            exp=api_key.expires_at,
        )
        return CreateSystemApiKeyMutationPayload(
            jwt=encoded_jwt,
            api_key=SystemApiKey(
                id_attr=api_key.id,
                name=api_key.name,
                description=api_key.description,
                created_at=api_key.created_at,
                expires_at=api_key.expires_at,
            ),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[HasSecret, IsAuthenticated])  # type: ignore
    async def delete_system_api_key(
        self, info: Info[Context, None], input: DeleteApiKeyInput
    ) -> DeleteSystemApiKeyMutationPayload:
        api_key_id = from_global_id_with_expected_type(
            input.id, expected_type_name=SystemApiKey.__name__
        )
        async with info.context.db() as session:
            api_key = await session.get(models.APIKey, api_key_id)
            if api_key is None:
                raise NotFound(f"Unknown System API Key: {input.id}")

            await session.delete(api_key)

        return DeleteSystemApiKeyMutationPayload(id=input.id, query=Query())


def create_jwt(
    *,
    secret: str,
    algorithm: str = "HS256",
    name: str,
    description: Optional[str],
    iat: datetime,
    exp: Optional[datetime],
    id: int,
) -> str:
    """Create a signed JSON Web Token for authentication

    Args:
        secret (str): the secret to sign with
        name (str): name of the key / token
        description (Optional[str]): description of the token
        iat (datetime): the issued at time
        exp (Optional[datetime]): the expiry, if set
        id (int): the id of the key
        algorithm (str, optional): the algorithm to use. Defaults to "HS256".

    Returns:
        str: The encoded JWT
    """
    payload: Dict[str, Any] = {
        "name": name,
        "description": description,
        "iat": iat.utcnow(),
        "id": id,
    }
    if exp is not None:
        payload["exp"] = exp.utcnow()

    # Encode the payload to create the JWT
    token = jwt.encode(payload, secret, algorithm=algorithm)

    return token
