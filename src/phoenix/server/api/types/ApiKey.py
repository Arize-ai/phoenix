from datetime import datetime
from typing import Optional

import strawberry
from strawberry import Info

from phoenix.server.api.context import Context


@strawberry.interface
class ApiKey:
    @strawberry.field(description="Name of the API key.")  # type: ignore
    async def name(
        self,
        info: Info[Context, None],
    ) -> str:
        raise NotImplementedError

    @strawberry.field(description="Description of the API key.")  # type: ignore
    async def description(
        self,
        info: Info[Context, None],
    ) -> Optional[str]:
        raise NotImplementedError

    @strawberry.field(description="The date and time the API key was created.")  # type: ignore
    async def created_at(
        self,
        info: Info[Context, None],
    ) -> datetime:
        raise NotImplementedError

    @strawberry.field(description="The date and time the API key will expire.")  # type: ignore
    async def expires_at(
        self,
        info: Info[Context, None],
    ) -> Optional[datetime]:
        raise NotImplementedError
