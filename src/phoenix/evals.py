from dataclasses import dataclass
from typing import (
    Any,
    List,
    Literal,
    Mapping,
    Optional,
    Protocol,
    Sequence,
    TypeAlias,
    TypedDict,
    Union,
)

from langchain.chat_models.base import BaseChatModel as LangChainBaseChatModel
from langchain.llms.base import BaseLLM as LangChainBaseLLM
from litellm.llms.base import BaseLLM as LiteLLMBaseLLM
from llama_index.llms.base import BaseModel as LlamaIndexBaseModel

JobID: TypeAlias = str
Record: TypeAlias = Mapping[str, Any]
Evaluation: TypeAlias = Union[str, int, float]
Evaluations: TypeAlias = List[Evaluation]


class Message(TypedDict):
    role: str
    content: str


# LLM and chat model interfaces. The `generate` method for both are meant to encapsulate a single request.


@dataclass
class Classification:
    content: str
    explanation: Optional[str] = None


# LLM interface.
class BaseCompletionModel(Protocol):
    def generate(self, prompts: List[str]) -> List[List[str]]:
        # Support batch input (e.g., the OpenAI completions API accepts batches of prompts as input)
        # Support multiple choices in the output (e.g., the OpenAI completions API returns multiple
        # completions per prompt when the parameter n is set to a value greater than 1)
        ...


# Chat model interface.
class BaseChatModel(Protocol):
    def generate(self, messages: List[Message]) -> List[Message]:
        # The output is a list of messages because some APIs can produce multiple candidate responses per input.
        # This is assuming that we don't need to support batch inputs for chat models.
        # Question: Do we need to support batch inputs for chat models? LangChain does this, not sure why.
        ...


BaseModel = Union[BaseCompletionModel, BaseChatModel]


# Natively supported models (specific model parameters are omitted)
class OpenAICompletionModel:
    def __init__(self, model_name: str) -> None:
        # dynamically import the OpenAI SDK to contain the dependency
        # (add model parameters to the function signature as needed)
        raise NotImplementedError()

    def generate(self, prompts: List[str]) -> List[List[str]]:
        raise NotImplementedError()


class OpenAIChatModel:
    def __init__(self, model_name: str) -> None:
        # dynamically import the OpenAI SDK to contain the dependency
        # (add model parameters to the function signature as needed)
        raise NotImplementedError()

    def generate(self, messages: List[Message]) -> List[Message]:
        raise NotImplementedError()


# Adapters for LLM orchestration frameworks
class LangChainCompletionModel:
    def __init__(self, model: LangChainBaseLLM) -> None:
        # dynamically imports LangChain to contain the dependency
        raise NotImplementedError()

    def generate(self, prompts: List[str]) -> List[List[str]]:
        raise NotImplementedError()


class LangChainChatModel:
    def __init__(self, model: LangChainBaseChatModel) -> None:
        # dynamically imports LangChain to contain the dependency
        raise NotImplementedError()

    def generate(self, messages: List[Message]) -> List[Message]:
        raise NotImplementedError()


class LlamaIndexCompletionModel:
    def __init__(self, model: LlamaIndexBaseModel) -> None:
        # dynamically imports LlamaIndex to contain the dependency
        raise NotImplementedError()

    def generate(self, prompts: List[str]) -> List[List[str]]:
        raise NotImplementedError()


class LlamaIndexChatModel:
    def __init__(self, model: LlamaIndexBaseModel) -> None:
        # dynamically imports LlamaIndex to contain the dependency
        raise NotImplementedError()

    def generate(self, messages: List[Message]) -> List[Message]:
        raise NotImplementedError()


class LiteLLMCompletionModel:
    def __init__(self, model: LiteLLMBaseLLM) -> None:
        # dynamically imports LiteLLM to contain the dependency
        raise NotImplementedError()

    def generate(self, prompts: List[str]) -> List[List[str]]:
        raise NotImplementedError()


class LiteLLMChatModel:
    def __init__(self, model: LiteLLMBaseLLM) -> None:
        # dynamically imports LlamaIndex to contain the dependency
        raise NotImplementedError()

    def generate(self, messages: List[Message]) -> List[Message]:
        raise NotImplementedError()


# Prompt Template
class PromptTemplate(Protocol):
    @property
    def template_string(self) -> str:
        ...

    def format(self, **kwargs) -> str:
        ...


# LLM classification config
@dataclass
class LLMClassificationConfig:
    # Question: Are we making the correct assumption that there is one template and an optional system message string?
    template: PromptTemplate
    rails: Sequence[str]
    system_message: Optional[str] = None
    default_rail: str = "UNPARSABLE"


@dataclass
class RAGVariableNames:
    query_variable_name: str
    reference_variable_name: str


class RAGRelevanceClassificationConfig(RAGVariableNames, LLMClassificationConfig):
    ...


DefaultRAGRelevanceClassificationConfig = RAGRelevanceClassificationConfig(
    template=PromptTemplate(template_string="Query: {query}\nReference: {reference}\nResponse: "),
    rails=("relevant", "irrelevant"),
    system_message='You are an assistant whose purpose is to classify a document as relevant or irrelevant to a query. You must respond with a single word, either "relevant" or "irrelevant".',
    query_variable_name="query",
    reference_variable_name="reference",
)


@dataclass
class FunctionCallingPrompts:
    function_name: str  # e.g., "record_relevance_classification"
    function_description: str  # e.g., "Classifies a record as relevant or irrelevant to a query."
    argument_name: str  # e.g., "relevancy"
    argument_description: str  # e.g., "A string indicating whether the record is relevant or irrelevant to the query"


class LLMFunctionsClassificationConfig(FunctionCallingPrompts, LLMClassificationConfig):
    ...


# Configuration for running batches of predictions
@dataclass
class RetryConfig:
    ...


@dataclass
class ManualRollingWindow:
    rolling_window_duration: int  # duration of the rolling window in seconds
    max_requests_per_window: int
    max_tokens_per_window: int


# In the case of certain APIs such as the OpenAI API, we're able to get the
# rate-limits from the API at runtime and can infer the parameters in the rolling window
@dataclass
class AutomaticRollingWindow:
    ...


@dataclass
class RequestConfig:
    retry_settings: RetryConfig
    rolling_window: Optional[Union[ManualRollingWindow, AutomaticRollingWindow]]
    completions_per_request: Optional[
        int
    ] = None  # for completion APIs supporting batch completions
    thread_requests: bool = True


# Recommended batch configurations for different foundation models and APIs.
DefaultOpenAIGPT4RequestConfig = RequestConfig(
    retry_settings=RetryConfig(),
    rolling_window=AutomaticRollingWindow(),
)


DefaultOpenAIGPT35TurboRequestConfig = ...


DefaultAnthropicClaude2RequestConfig = ...


# LLM classifiers.
class BaseLLMClassifier(Protocol):
    def predict(self, record: Record) -> Classification:
        ...


class LLMClassifier:
    def __init__(
        self,
        model: BaseModel,
        classification_config: LLMClassificationConfig,
    ) -> None:
        raise NotImplementedError()

    def predict(self, record: Record) -> Classification:
        raise NotImplementedError()


class LLMClassifierWithExplanation:
    def __init__(
        self,
        model: BaseModel,
        classification_config: LLMClassificationConfig,  # This classification config object is the same as before, but the prompts need to contain explicit instructions about providing explanations and how to format the classification and explanation together in the output.
    ) -> None:
        raise NotImplementedError()

    def predict(self, record: Record) -> Classification:
        raise NotImplementedError()


class FunctionsClassifier:
    def __init__(
        self,
        model: OpenAIChatModel,  # function calling is a feature of only the OpenAI API
        classification_config: LLMFunctionsClassificationConfig,
    ) -> None:
        raise NotImplementedError()

    def predict(self, record: Record, *, provide_explanation: bool = False) -> Classification:
        raise NotImplementedError()


# Support for fine-tuning.
class OpenAIFineTuningJob:
    def __init__(
        self,
        classification_config: LLMClassificationConfig,
        model_name: str,
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
    def __init__(
        self, evaluators: List[Evaluator], job_config: Optional[RequestConfig] = None
    ) -> None:
        raise NotImplementedError()

    @classmethod
    def from_names(
        self,
        eval_names: List[str],
        *,
        model: Optional[BaseModel] = None,
        job_config: Optional[RequestConfig] = None,
    ) -> "Evals":
        raise NotImplementedError()

    def run(self, records: List[Record]) -> List[Evaluations]:
        raise NotImplementedError()
