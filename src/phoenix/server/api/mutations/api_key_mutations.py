from datetime import datetime
from typing import Any, Dict, Optional

import jwt
import strawberry
from sqlalchemy import insert, select
from strawberry import UNSET
from strawberry.types import Info

from phoenix.config import get_auth_settings
from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.mutations.auth import IsAuthenticated
from phoenix.server.api.queries import Query
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


# TODO(auth): mount this centrally
_, secret = get_auth_settings()


@strawberry.type
class ApiKeyMutationMixin:
    @strawberry.mutation(permission_classes=[IsAuthenticated])  # type: ignore
    async def create_system_api_key(
        self, info: Info[Context, None], input: CreateApiKeyInput
    ) -> CreateSystemApiKeyMutationPayload:
        # TODO(auth): safe guard against auth being disabled and secret not being set
        if secret is None:
            raise ValueError("Cannot create keys without a secret")
        async with info.context.db() as session:
            # Get the system user - note this could be pushed into a dataloader
            system_user = await session.scalar(
                select(models.User)
                .join(models.User.role)  # Join User with UserRole
                .where(models.UserRole.role == "SYSTEM")  # Filter where role is SYSTEM
                .limit(1)
            )
            if system_user is None:
                raise ValueError("System user not found")

            api_key = await session.scalar(
                insert(models.APIKey)
                .values(
                    user_id=system_user.id,
                    name=input.name or "System API Key",
                    description=input.description,
                )
                .returning(models.APIKey)
            )
            assert api_key is not None

        encoded_jwt = create_jwt(
            secret=secret,
            name=api_key.name,
            user_id=api_key.user_id,
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


def create_jwt(
    *,
    secret: str,
    algorithm: str = "HS256",
    name: str,
    description: Optional[str],
    iat: datetime,
    exp: Optional[datetime],
    user_id: int,
) -> str:
    """Create a signed JSON Web Token for authentication

    Args:
        secret (str): the secret to sign with
        name (str): name of the key / token
        description (Optional[str]): description of the token
        iat (datetime): the issued at time
        exp (Optional[datetime]): the expiry, if set
        user_id (int): the system / end-user id
        algorithm (str, optional): the algorithm to use. Defaults to "HS256".

    Returns:
        str: _description_
    """
    payload: Dict[str, Any] = {
        "name": name,
        "description": description,
        "iat": iat.utcnow(),
        "user_id": user_id,
    }
    if exp is not None:
        payload["exp"] = exp.utcnow()

    # Encode the payload to create the JWT
    token = jwt.encode(payload, secret, algorithm=algorithm)

    return token
