from datetime import datetime
from typing import Optional

import strawberry

from phoenix.db.models import ApiKey as ORMApiKey


@strawberry.interface
class ApiKey:
    name: str = strawberry.field(description="Name of the API key.")
    description: Optional[str] = strawberry.field(description="Description of the API key.")
    created_at: datetime = strawberry.field(
        description="The date and time the API key was created."
    )
    expires_at: Optional[datetime] = strawberry.field(
        description="The date and time the API key will expire."
    )


def to_gql_api_key(api_key: ORMApiKey) -> ApiKey:
    return ApiKey(
        name=api_key.name,
        description=api_key.description,
        created_at=api_key.created_at,
        expires_at=api_key.expires_at,
    )
