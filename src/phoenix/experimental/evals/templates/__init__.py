from .default_templates import HALLUCINATION_PROMPT_TEMPLATE_STR, RAG_RELEVANCY_PROMPT_TEMPLATE_STR
from .template import PromptTemplate

__all__ = [
    "PromptTemplate",
    "RAG_RELEVANCY_PROMPT_TEMPLATE_STR",
    "HALLUCINATION_PROMPT_TEMPLATE_STR",
]
