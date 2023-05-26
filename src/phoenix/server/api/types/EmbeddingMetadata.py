from typing import Optional

import strawberry

from phoenix.server.api.interceptor import GqlValueMediator


@strawberry.type
class EmbeddingMetadata:
    """Embedding specific metadata. E.g. the raw text and image source"""

    prediction_id: Optional[str] = strawberry.field(default=GqlValueMediator())
    raw_data: Optional[str] = strawberry.field(default=GqlValueMediator())
    link_to_data: Optional[str] = strawberry.field(default=GqlValueMediator())
