from typing import Optional

import strawberry

from phoenix.server.api.interceptor import NoneIfNan


@strawberry.type
class EmbeddingMetadata:
    """Embedding specific metadata. E.g. the raw text and image source"""

    prediction_id: Optional[str] = strawberry.field(default=NoneIfNan())
    raw_data: Optional[str] = strawberry.field(default=NoneIfNan())
    link_to_data: Optional[str] = strawberry.field(default=NoneIfNan())
