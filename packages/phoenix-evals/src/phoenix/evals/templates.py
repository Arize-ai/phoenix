from .legacy.templates import (
    ClassificationTemplate,
    InvalidClassificationTemplateError,
    MultimodalPrompt,
    PromptOptions,
    PromptPartContentType,
    PromptPartTemplate,
    PromptTemplate,
    map_template,
    normalize_prompt_template,
)

__all__ = [
    "ClassificationTemplate",
    "PromptTemplate",
    "PromptPartContentType",
    "PromptPartTemplate",
    "PromptOptions",
    "MultimodalPrompt",
    "map_template",
    "normalize_prompt_template",
    "InvalidClassificationTemplateError",
]
