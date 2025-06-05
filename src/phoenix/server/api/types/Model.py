from datetime import datetime
from typing import Optional

import strawberry
from strawberry.relay import Node, NodeID

from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey
from phoenix.server.api.types.ModelInterface import ModelInterface


@strawberry.type
class Model(Node, ModelInterface):
    id_attr: NodeID[int]
    name: str
    provider: Optional[str]
    name_pattern: str
    created_at: datetime
    updated_at: datetime
    provider_key: Optional[GenerativeProviderKey]
