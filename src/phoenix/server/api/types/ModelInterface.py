from typing import Optional

import strawberry

from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey


@strawberry.interface
class ModelInterface:
    name: str
    provider_key: Optional[GenerativeProviderKey]
