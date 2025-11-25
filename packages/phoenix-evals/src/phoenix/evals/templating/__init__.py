"""
Templating module - DEPRECATED

This module has been moved to phoenix.evals.llm.prompts.
All imports from this module will continue to work but will issue deprecation warnings.

Please update your imports to use phoenix.evals.llm.prompts instead.
"""

import warnings

# Re-export everything from the new location for backward compatibility
from phoenix.evals.llm.prompts import (
    ContentPart,
    ContentPartTemplate,
    FormatterFactory,
    FStringFormatter,
    ImageUrlContentPart,
    ImageUrlContentPartTemplate,
    Message,
    MessageRole,
    MessageTemplate,
    MustacheFormatter,
    PromptLike,
    PromptTemplate,
    Template,
    TemplateFormat,
    TemplateFormatter,
    TextContentPart,
    TextContentPartTemplate,
    create_content_part_template,
    detect_template_format,
)

# Issue deprecation warning when module is imported
warnings.warn(
    "The phoenix.evals.templating module is deprecated and will be removed in a future version. "
    "Please use phoenix.evals.llm.prompts instead.",
    DeprecationWarning,
    stacklevel=2,
)

__all__ = [
    "ContentPart",
    "ContentPartTemplate",
    "FormatterFactory",
    "FStringFormatter",
    "ImageUrlContentPart",
    "ImageUrlContentPartTemplate",
    "Message",
    "MessageRole",
    "MessageTemplate",
    "MustacheFormatter",
    "PromptLike",
    "PromptTemplate",
    "Template",
    "TemplateFormat",
    "TemplateFormatter",
    "TextContentPart",
    "TextContentPartTemplate",
    "create_content_part_template",
    "detect_template_format",
]
