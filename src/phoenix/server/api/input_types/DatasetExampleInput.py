from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.scalars import JSON

from phoenix.server.api.redaction import Redacted


@strawberry.input
class DatasetExampleInput:
    input: Redacted[JSON]
    output: Redacted[JSON]
    metadata: Redacted[JSON]
    span_id: Optional[GlobalID] = UNSET
    external_id: Optional[str] = UNSET
