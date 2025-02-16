import strawberry
from strawberry.scalars import JSON

from phoenix.server.api.helpers.prompts.models import PromptTemplateFormat


@strawberry.input
class PromptTemplateOptions:
    variables: JSON
    format: PromptTemplateFormat
