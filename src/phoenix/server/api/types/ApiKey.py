from datetime import datetime
from typing import Optional

import strawberry


@strawberry.interface
class ApiKey:
    @strawberry.field(description="Name of the API key.")
    async def name(self) -> str:
        raise NotImplementedError

    @strawberry.field(description="Description of the API key.")
    async def description(self) -> Optional[str]:
        raise NotImplementedError

    @strawberry.field(description="The date and time the API key was created.")
    async def created_at(self) -> datetime:
        raise NotImplementedError

    @strawberry.field(description="The date and time the API key will expire.")
    async def expires_at(self) -> Optional[datetime]:
        raise NotImplementedError
