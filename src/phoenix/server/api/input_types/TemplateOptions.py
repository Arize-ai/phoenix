import strawberry
from strawberry.scalars import JSON

from phoenix.server.api.helpers.prompts.models import TemplateFormat


@strawberry.input
class TemplateOptions:
    variables: JSON
    format: TemplateFormat
