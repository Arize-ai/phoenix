import strawberry
from strawberry.scalars import JSON

from phoenix.db.types.prompts import PromptTemplateFormat


@strawberry.input
class PromptTemplateOptions:
    variables: JSON
    format: PromptTemplateFormat
