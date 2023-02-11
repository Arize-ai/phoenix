from typing import Optional

import strawberry


@strawberry.type
class EmbeddingMetadata:
    """Embedding specific metadata. E.g. the raw text and image source"""

    raw_data: Optional[str]
    link_to_data: Optional[str]
