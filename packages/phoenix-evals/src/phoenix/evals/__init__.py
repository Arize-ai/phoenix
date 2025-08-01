import sys
import warnings
from importlib.abc import Loader, MetaPathFinder
from importlib.machinery import ModuleSpec
from importlib.metadata import version
from types import ModuleType
from typing import Any, Dict, List, Optional, Set

from .classify import llm_classify, run_evals
from .default_templates import (
    CODE_FUNCTIONALITY_PROMPT_RAILS_MAP,
    CODE_FUNCTIONALITY_PROMPT_TEMPLATE,
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
    REFERENCE_LINK_CORRECTNESS_PROMPT_RAILS_MAP,
    REFERENCE_LINK_CORRECTNESS_PROMPT_TEMPLATE,
    SQL_GEN_EVAL_PROMPT_RAILS_MAP,
    SQL_GEN_EVAL_PROMPT_TEMPLATE,
    TOOL_CALLING_PROMPT_RAILS_MAP,
    TOOL_CALLING_PROMPT_TEMPLATE,
    TOXICITY_PROMPT_RAILS_MAP,
    TOXICITY_PROMPT_TEMPLATE,
    USER_FRUSTRATION_PROMPT_RAILS_MAP,
    USER_FRUSTRATION_PROMPT_TEMPLATE,
)
from .evaluators import (
    HallucinationEvaluator,
    LLMEvaluator,
    QAEvaluator,
    RelevanceEvaluator,
    SQLEvaluator,
    SummarizationEvaluator,
    ToxicityEvaluator,
)
from .generate import llm_generate
from .models import (
    AnthropicModel,
    BedrockModel,
    GeminiModel,
    GoogleGenAIModel,
    LiteLLMModel,
    MistralAIModel,
    OpenAIModel,
    VertexAIModel,
)
from .retrievals import compute_precisions_at_k
from .span_templates import (
    HALLUCINATION_SPAN_PROMPT_TEMPLATE,
    QA_SPAN_PROMPT_TEMPLATE,
    TOOL_CALLING_SPAN_PROMPT_TEMPLATE,
)
from .templates import (
    ClassificationTemplate,
    PromptTemplate,
)
from .utils import NOT_PARSABLE, download_benchmark_dataset, emoji_guard

EXPERIMENTAL_MODULES: Dict[str, Dict[str, Any]] = {
    "phoenix.evals.llm": {
        "warning_message": (
            f"\n\n{emoji_guard('⚠️', '!!')} EXPERIMENTAL: The phoenix.evals.llm module and all "
            "its components are experimental and subject to change without notice. This code "
            "should not be used in production."
        ),
        "warn_on_access": True,
        "warning_on_import": True,
    },
    "phoenix.evals.templating": {
        "warning_message": (
            f"\n\n{emoji_guard('⚠️', '!!')} EXPERIMENTAL: The phoenix.evals.templating module and "
            "all its components are experimental and subject to change without notice. This code "
            "should not be used in production."
        ),
        "warn_on_access": True,
        "warning_on_import": True,
    },
}

_experimental_warnings_shown: Set[str] = set()


class ExperimentalModuleWrapper:
    def __init__(self, real_module: Any, module_config: Dict[str, Any]):
        self._real_module = real_module
        self._module_config = module_config
        self._module_name = real_module.__name__

    def __getattr__(self, name: str) -> Any:
        if (
            self._module_config.get("warn_on_access", False)
            and self._module_name not in _experimental_warnings_shown
        ):
            warnings.warn(
                self._module_config["warning_message"],
                UserWarning,
                stacklevel=2,
            )
            _experimental_warnings_shown.add(self._module_name)

        return getattr(self._real_module, name)

    def __dir__(self) -> List[str]:
        return dir(self._real_module)

    def __repr__(self) -> str:
        return repr(self._real_module)

    def __getitem__(self, key: Any) -> Any:
        return self._real_module[key]

    def __setattr__(self, name: str, value: Any) -> None:
        if name.startswith("_"):
            super().__setattr__(name, value)
        else:
            setattr(self._real_module, name, value)


class ExperimentalModuleFinder(MetaPathFinder):
    """MetaPathFinder that intercepts imports of experimental modules."""

    def find_spec(self, fullname: str, path: Any, target: Any = None) -> Optional[ModuleSpec]:
        if fullname in EXPERIMENTAL_MODULES:
            for finder in sys.meta_path:
                if finder is self:
                    continue
                spec = finder.find_spec(fullname, path, target)
                if spec is not None:
                    original_loader = spec.loader
                    spec.loader = ExperimentalModuleLoader(
                        original_loader, EXPERIMENTAL_MODULES[fullname]
                    )
                    return spec
        return None


class ExperimentalModuleLoader(Loader):
    """Loader that wraps experimental modules after loading them."""

    def __init__(self, real_loader: Optional[Loader], module_config: Dict[str, Any]):
        self.real_loader = real_loader
        self.module_config = module_config

    def create_module(self, spec: ModuleSpec) -> Optional[ModuleType]:
        if self.real_loader is None:
            return None
        return self.real_loader.create_module(spec)

    def exec_module(self, module: ModuleType) -> None:
        if self.real_loader is None:
            return

        self.real_loader.exec_module(module)

        if self.module_config.get("warn_on_access", False):
            wrapper = ExperimentalModuleWrapper(module, self.module_config)
            sys.modules[module.__name__] = wrapper  # type: ignore[assignment]

            module_parts = module.__name__.split(".")
            if len(module_parts) > 1:
                parent_name = ".".join(module_parts[:-1])
                module_attr_name = module_parts[-1]
                if parent_name in sys.modules:
                    parent_module = sys.modules[parent_name]
                    if hasattr(parent_module, module_attr_name):
                        setattr(parent_module, module_attr_name, wrapper)


sys.meta_path.insert(0, ExperimentalModuleFinder())

from . import llm  # noqa: E402

__version__ = version("arize-phoenix-evals")

__all__ = [
    "compute_precisions_at_k",
    "download_benchmark_dataset",
    "llm",
    "llm_classify",
    "llm_generate",
    "OpenAIModel",
    "AnthropicModel",
    "GeminiModel",
    "GoogleGenAIModel",
    "VertexAIModel",
    "BedrockModel",
    "LiteLLMModel",
    "MistralAIModel",
    "PromptTemplate",
    "ClassificationTemplate",
    "CODE_READABILITY_PROMPT_RAILS_MAP",
    "CODE_READABILITY_PROMPT_TEMPLATE",
    "HALLUCINATION_PROMPT_RAILS_MAP",
    "HALLUCINATION_PROMPT_TEMPLATE",
    "RAG_RELEVANCY_PROMPT_RAILS_MAP",
    "RAG_RELEVANCY_PROMPT_TEMPLATE",
    "TOXICITY_PROMPT_RAILS_MAP",
    "TOXICITY_PROMPT_TEMPLATE",
    "HUMAN_VS_AI_PROMPT_RAILS_MAP",
    "HUMAN_VS_AI_PROMPT_TEMPLATE",
    "REFERENCE_LINK_CORRECTNESS_PROMPT_RAILS_MAP",
    "REFERENCE_LINK_CORRECTNESS_PROMPT_TEMPLATE",
    "QA_PROMPT_RAILS_MAP",
    "QA_PROMPT_TEMPLATE",
    "SQL_GEN_EVAL_PROMPT_RAILS_MAP",
    "SQL_GEN_EVAL_PROMPT_TEMPLATE",
    "CODE_FUNCTIONALITY_PROMPT_RAILS_MAP",
    "CODE_FUNCTIONALITY_PROMPT_TEMPLATE",
    "USER_FRUSTRATION_PROMPT_RAILS_MAP",
    "USER_FRUSTRATION_PROMPT_TEMPLATE",
    "TOOL_CALLING_PROMPT_TEMPLATE",
    "TOOL_CALLING_PROMPT_RAILS_MAP",
    "NOT_PARSABLE",
    "run_evals",
    "LLMEvaluator",
    "HallucinationEvaluator",
    "QAEvaluator",
    "RelevanceEvaluator",
    "SQLEvaluator",
    "SummarizationEvaluator",
    "ToxicityEvaluator",
    "HALLUCINATION_SPAN_PROMPT_TEMPLATE",
    "QA_SPAN_PROMPT_TEMPLATE",
    "TOOL_CALLING_SPAN_PROMPT_TEMPLATE",
]
