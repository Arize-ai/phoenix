import strawberry
from strawberry.scalars import JSON

from phoenix.server.api.types.TemplateLanguage import TemplateLanguage


@strawberry.input
class TemplateOptions:
    variables: JSON
    language: TemplateLanguage
