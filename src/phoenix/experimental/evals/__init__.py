import logging
import sys
from typing import Any

from .evaluators import (
    HallucinationEvaluator,
    LLMEvaluator,
    QAEvaluator,
    RelevanceEvaluator,
    SummarizationEvaluator,
    ToxicityEvaluator,
)
from .functions import llm_classify, llm_generate, run_evals, run_relevance_eval
from .models import BedrockModel, LiteLLMModel, OpenAIModel, VertexAIModel
from .retrievals import compute_precisions_at_k
from .templates import (
    CODE_READABILITY_PROMPT_RAILS_MAP,
    CODE_READABILITY_PROMPT_TEMPLATE,
    HALLUCINATION_PROMPT_RAILS_MAP,
    HALLUCINATION_PROMPT_TEMPLATE,
    HUMAN_VS_AI_PROMPT_RAILS_MAP,
    HUMAN_VS_AI_PROMPT_TEMPLATE,
    QA_PROMPT_RAILS_MAP,
    QA_PROMPT_TEMPLATE,
    RAG_RELEVANCY_PROMPT_RAILS_MAP,
    RAG_RELEVANCY_PROMPT_TEMPLATE,
    TOXICITY_PROMPT_RAILS_MAP,
    TOXICITY_PROMPT_TEMPLATE,
    ClassificationTemplate,
    PromptTemplate,
)
from .utils import NOT_PARSABLE, download_benchmark_dataset

logger = logging.getLogger(__name__)


exported = {
    "compute_precisions_at_k": compute_precisions_at_k,
    "download_benchmark_dataset": download_benchmark_dataset,
    "llm_classify": llm_classify,
    "llm_generate": llm_generate,
    "OpenAIModel": OpenAIModel,
    "VertexAIModel": VertexAIModel,
    "BedrockModel": BedrockModel,
    "LiteLLMModel": LiteLLMModel,
    "PromptTemplate": PromptTemplate,
    "ClassificationTemplate": ClassificationTemplate,
    "CODE_READABILITY_PROMPT_RAILS_MAP": CODE_READABILITY_PROMPT_RAILS_MAP,
    "CODE_READABILITY_PROMPT_TEMPLATE": CODE_READABILITY_PROMPT_TEMPLATE,
    "HALLUCINATION_PROMPT_RAILS_MAP": HALLUCINATION_PROMPT_RAILS_MAP,
    "HALLUCINATION_PROMPT_TEMPLATE": HALLUCINATION_PROMPT_TEMPLATE,
    "RAG_RELEVANCY_PROMPT_RAILS_MAP": RAG_RELEVANCY_PROMPT_RAILS_MAP,
    "RAG_RELEVANCY_PROMPT_TEMPLATE": RAG_RELEVANCY_PROMPT_TEMPLATE,
    "TOXICITY_PROMPT_RAILS_MAP": TOXICITY_PROMPT_RAILS_MAP,
    "TOXICITY_PROMPT_TEMPLATE": TOXICITY_PROMPT_TEMPLATE,
    "HUMAN_VS_AI_PROMPT_RAILS_MAP": HUMAN_VS_AI_PROMPT_RAILS_MAP,
    "HUMAN_VS_AI_PROMPT_TEMPLATE": HUMAN_VS_AI_PROMPT_TEMPLATE,
    "QA_PROMPT_RAILS_MAP": QA_PROMPT_RAILS_MAP,
    "QA_PROMPT_TEMPLATE": QA_PROMPT_TEMPLATE,
    "NOT_PARSABLE": NOT_PARSABLE,
    "run_relevance_eval": run_relevance_eval,
    "run_evals": run_evals,
    "LLMEvaluator": LLMEvaluator,
    "HallucinationEvaluator": HallucinationEvaluator,
    "QAEvaluator": QAEvaluator,
    "RelevanceEvaluator": RelevanceEvaluator,
    "SummarizationEvaluator": SummarizationEvaluator,
    "ToxicityEvaluator": ToxicityEvaluator,
}


class _DEPRECATED_MODULE:
    __all__ = tuple(exported.keys())

    def __getattr__(self, name: str) -> Any:
        if name not in exported:
            raise AttributeError(f"module {__name__} has no attribute {name}")
        logger.warning(
            "Evals are moving out of experimental."
            "Install the evals extra with `pip install arize-phoenix[evals]` and "
            f"import `phoenix.evals.{name}`. "
            "For more info, see the [migration guide](https://github.com/Arize-ai/phoenix/blob/main/MIGRATION.md)."
        )
        return exported[name]


# See e.g. https://stackoverflow.com/a/7668273
sys.modules[__name__] = _DEPRECATED_MODULE()  # type: ignore
