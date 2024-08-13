from datetime import datetime
from typing import Optional

import strawberry


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
