from typing import Optional

import strawberry


@strawberry.type
class EmbeddingMetadata:
    """Embedding specific metadata. E.g. the raw text and image source"""

    prediction_id: Optional[str] = None
    raw_data: Optional[str] = None
    link_to_data: Optional[str] = None
