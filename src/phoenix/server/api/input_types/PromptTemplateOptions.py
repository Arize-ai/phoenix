import strawberry
from strawberry.scalars import JSON

from phoenix.db.types.prompts import PromptTemplateFormat
from phoenix.server.api.redaction import Redacted


@strawberry.input
class PromptTemplateOptions:
    variables: Redacted[JSON]
    format: PromptTemplateFormat
