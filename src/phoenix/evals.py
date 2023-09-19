from dataclasses import dataclass
from typing import Any, Dict, List, Literal, Optional, Protocol, TypeAlias, Union

import pandas as pd
from langchain.chat_models.base import BaseChatModel as LangChainBaseChatModel
from langchain.llms.base import BaseLLM as LangChainBaseLLM
from llama_index.llms.base import BaseModel as LlamaIndexBaseModel

JobID: TypeAlias = str
Record: TypeAlias = Dict[str, Any]
ClassificationPrediction: TypeAlias = Union[str, int]
Evaluation: TypeAlias = Union[str, int, float]
Evaluations: TypeAlias = List[Evaluation]


# Model interface.
class BaseModel(Protocol):
    def generate(self, prompt: str, *, system_prompt: Optional[str] = None) -> str:
        ...


# Natively supported models.
class OpenAIModel:
    def __init__(self, model_name: str) -> None:
        # dynamically import the OpenAI SDK to contain the dependency
        # (add model parameters to the function signature as needed)
        raise NotImplementedError()

    def generate(self, prompt: str, *, system_prompt: Optional[str] = None) -> str:
        raise NotImplementedError()


class AnthropicModel:
    def __init__(self, model_name: str) -> None:
        # dynamically import the Anthropic SDK to contain the dependency
        # (add model parameters to the function signature as needed)
        raise NotImplementedError()

    def generate(self, prompt: str, *, system_prompt: Optional[str] = None) -> str:
        raise NotImplementedError()


# Adapters for LLM orchestration frameworks
# (users will not typically interact with these directly)
class LangChainLLMAdapter:
    def __init__(self, model: LangChainBaseLLM) -> None:
        # dynamically imports LangChain to contain the dependency
        raise NotImplementedError()

    def generate(self, prompt: str, *, system_prompt: Optional[str] = None) -> str:
        # delegates to the wrapped LangChain LLM
        raise NotImplementedError()


class LangChainChatModelAdapter:
    def __init__(self, model: LangChainBaseChatModel) -> None:
        # dynamically imports LangChain to contain the dependency
        raise NotImplementedError()

    def generate(self, prompt: str, *, system_prompt: Optional[str] = None) -> str:
        # delegates to the wrapped LangChain chat model
        raise NotImplementedError()


class LlamaIndexModelAdapter:
    def __init__(self, model: LlamaIndexBaseModel) -> None:
        # dynamically imports LlamaIndex to contain the dependency
        raise NotImplementedError()

    def generate(self, prompt: str, *, system_prompt: Optional[str] = None) -> str:
        # delegates to the wrapped LlamaIndex model
        raise NotImplementedError()


# Prompt template.
class ClassificationPromptTemplate:
    def __init__(self, template: str, classes: List[str]) -> None:
        raise NotImplementedError()

    def format(self, *args, **kwargs) -> str:
        raise NotImplementedError()


RELEVANCE_PROMPT_TEMPLATE = ClassificationPromptTemplate(
    "some prompt we've test to death", ["relevant", "irrelevant"]
)
TOXICITY_PROMPT_TEMPLATE = ClassificationPromptTemplate(
    "some prompt we've test to death", ["toxic", "non-toxic"]
)
HALLUCINATION_PROMPT_TEMPLATE = ClassificationPromptTemplate(
    "some prompt we've test to death", ["hallucinated", "factual"]
)


# Configuration for running batches of predictions
@dataclass
class RetrySettings:
    ...


@dataclass
class JobConfig:
    max_requests_per_minute: int
    max_tokens_per_minute: int
    thread_requests: bool
    retry_settings: RetrySettings


# Recommended batch configurations for different foundation models and APIs.
# (tested by us to maximize throughput while avoiding rate limiting)
class DefaultOpenAIGPT4JobConfig(JobConfig):
    ...


class DefaultOpenAIGPT35TurboJobConfig(JobConfig):
    ...


class DefaultAnthropicClaude2JobConfig(JobConfig):
    ...


# LLM classifiers.
class BaseLLMClassifier(Protocol):
    def predict(self, record: Record) -> Optional[ClassificationPrediction]:
        ...

    def predict_batch(
        self, record: Record, *, job_config: Optional[JobConfig] = None
    ) -> List[Optional[ClassificationPrediction]]:
        ...

    def predict_dataframe(
        self, dataframe: pd.DataFrame, *, job_config: Optional[JobConfig] = None
    ) -> List[Optional[ClassificationPrediction]]:
        ...


class LLMClassifier:
    def __init__(
        self,
        model: BaseModel,
        prompt_template: ClassificationPromptTemplate,
        *,
        system_message: Optional[str] = None,
        default_return_value: Optional[str] = None,
    ) -> None:
        raise NotImplementedError()

    @classmethod
    def from_llama_index_model(
        cls, model: LlamaIndexBaseModel, prompt_template: ClassificationPromptTemplate
    ) -> "LLMClassifier":
        return cls(LlamaIndexModelAdapter(model), prompt_template)

    @classmethod
    def from_langchain_llm(
        cls, model: LangChainBaseLLM, prompt_template: ClassificationPromptTemplate
    ) -> "LLMClassifier":
        return cls(LangChainLLMAdapter(model), prompt_template)

    @classmethod
    def from_langchain_chat_model(
        cls,
        model: LangChainBaseChatModel,
        prompt_template: ClassificationPromptTemplate,
    ) -> "LLMClassifier":
        return cls(LangChainChatModelAdapter(model), prompt_template)

    def predict(self, record: Record) -> ClassificationPrediction:
        raise NotImplementedError()

    def predict_batch(
        self, record: Record, *, job_config: Optional[JobConfig] = None
    ) -> List[Optional[ClassificationPrediction]]:
        raise NotImplementedError()

    def predict_dataframe(
        self, dataframe: pd.DataFrame, *, job_config: Optional[JobConfig] = None
    ) -> List[Optional[ClassificationPrediction]]:
        raise NotImplementedError()


class OpenAIFunctionsClassifier:
    def __init__(
        self,
        prompt_template: ClassificationPromptTemplate,
        model: OpenAIModel,
        function_name: str,
        function_description: str,
        class_argument_name: str,
        class_argument_description: str,
        *,
        default_return_value: Optional[str] = None,
    ) -> None:
        raise NotImplementedError()

    def predict(
        self, record: Record, *, require_explanation: bool = False
    ) -> ClassificationPrediction:
        raise NotImplementedError()

    def predict_batch(
        self, record: Record, *, job_config: Optional[JobConfig] = None
    ) -> List[Optional[ClassificationPrediction]]:
        raise NotImplementedError()

    def predict_dataframe(
        self, dataframe: pd.DataFrame, *, job_config: Optional[JobConfig] = None
    ) -> List[Optional[ClassificationPrediction]]:
        raise NotImplementedError()


# Support for fine-tuning.
class OpenAIFineTuningJob:
    def __init__(
        self,
        prompt_template: ClassificationPromptTemplate,
        base_model_name: str,
        *,
        num_epochs: Optional[int] = None,
    ) -> None:
        raise NotImplementedError()

    @property
    def status(
        self,
    ) -> Literal["created", "pending", "running", "succeeded", "failed", "cancelled"]:
        """Forwards the status from fine-tuning job endpoint."""
        raise NotImplementedError()

    @property
    def model_name(self) -> Optional[str]:
        """
        Returns the name of the fine-tuned model if the job has succeeded,
        otherwise, returns None.
        """
        raise NotImplementedError()

    def create(self, data: List[Record]) -> JobID:
        """Kicks off fine-tuning job."""
        raise NotImplementedError()


# Evaluators
class Evaluator(Protocol):
    def evaluate(self, records: List[Record]) -> List[Evaluation]:
        ...

    @property
    def name(self) -> str:
        ...


class ClassificationEvaluator:
    def __init__(self, classifier: LLMClassifier, name: str) -> None:
        raise NotImplementedError()

    def evaluate(self, records: List[Record]) -> List[Evaluation]:
        """Delegates to the classifier."""
        raise NotImplementedError()

    @property
    def name(self) -> str:
        raise NotImplementedError()


# not sure how to handle something like precision@k that requires an
# classification evaluator before computing the score


# evals
class Evals:
    def __init__(self, evaluators: List[Evaluator], job_config: Optional[JobConfig] = None) -> None:
        raise NotImplementedError()

    @classmethod
    def from_names(
        self,
        eval_names: List[str],
        *,
        model: Optional[BaseModel] = None,
        job_config: Optional[JobConfig] = None,
    ) -> "Evals":
        raise NotImplementedError()

    def run(self, records: List[Record]) -> List[Evaluations]:
        raise NotImplementedError()
