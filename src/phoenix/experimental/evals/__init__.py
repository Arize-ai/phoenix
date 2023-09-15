from .functions import llm_eval_binary, llm_generate, run_relevance_eval
from .models import OpenAiModel
from .retrievals import compute_precisions_at_k
from .templates import (
    CODE_READABILITY_PROMPT_OUTPUT_MAP,
    CODE_READABILITY_PROMPT_TEMPLATE_STR,
    HALLUCINATION_PROMPT_RAILS_MAP,
    HALLUCINATION_PROMPT_TEMPLATE_STR,
    RAG_RELEVANCY_PROMPT_RAILS_MAP,
    RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
    TOXICITY_PROMPT_RAILS_MAP,
    TOXICITY_PROMPT_TEMPLATE_STR,
    PromptTemplate,
)
from .utils.downloads import download_benchmark_dataset

__all__ = [
    "compute_precisions_at_k",
    "download_benchmark_dataset",
    "llm_eval_binary",
    "llm_generate",
    "OpenAiModel",
    "PromptTemplate",
    "CODE_READABILITY_PROMPT_TEMPLATE_STR",
    "HALLUCINATION_PROMPT_RAILS_MAP",
    "HALLUCINATION_PROMPT_TEMPLATE_STR",
    "RAG_RELEVANCY_PROMPT_RAILS_MAP",
    "RAG_RELEVANCY_PROMPT_TEMPLATE_STR",
    "TOXICITY_PROMPT_TEMPLATE_STR",
    "TOXICITY_PROMPT_RAILS_MAP",
    "run_relevance_eval",
]
