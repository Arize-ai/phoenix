import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Union

from phoenix.evals.models.base import BaseModel
from phoenix.evals.models.rate_limiters import RateLimiter
from phoenix.evals.templates import MultimodalPrompt
from phoenix.evals.utils import printif

if TYPE_CHECKING:
    from google.auth.credentials import Credentials

logger = logging.getLogger(__name__)


# https://cloud.google.com/vertex-ai/docs/generative-ai/learn/models
MODEL_TOKEN_LIMIT_MAPPING = {
    "gemini-pro": 32760,
    "gemini-pro-vision": 16384,
}


@dataclass
class GeminiModel(BaseModel):
    """
    An interface for using Google's Gemini models.

    This class wraps the Google's VertexAI SDK library for using the Gemini models for Phoenix
    LLM evaluations. Calls to the the Gemini models dynamically throttled when encountering rate
    limit errors. Requires the `vertexai` package to be installed.

    Supports Async: ✅
        If possible, makes LLM calls concurrently.

    Args:
        model (str, optional): The model name to use. Defaults to "gemini-pro".
        temperature (float, optional): Sampling temperature to use. Defaults to 0.0.
        max_tokens (int, optional): Maximum number of tokens to generate in the completion.
            Defaults to 256.
        top_p (float, optional): Total probability mass of tokens to consider at each step.
            Defaults to 1.
        top_k (int, optional): The cutoff where the model no longer selects the words.
            Defaults to 32.
        stop_sequences (List[str], optional): If the model encounters a stop sequence, it stops
            generating further tokens. Defaults to an empty list.
        project (str, optional): The default project to use when making API calls. Defaults to
            None.
        location (str, optional): The default location to use when making API calls. If not set
            defaults to us-central-1. Defaults to None.
        credentials (Optional[Credentials], optional): The credentials to use when making API
            calls. Defaults to None.
        initial_rate_limit (int, optional): The initial internal rate limit in allowed requests
            per second for making LLM calls. This limit adjusts dynamically based on rate
            limit errors. Defaults to 5.
        timeout (int, optional): The timeout for completion requests in seconds. Defaults to 120.
        model_kwargs (Dict[str, Any], optional): Additional keyword arguments passed to the Vertex
            GenerativeModel constructor.

    Example:
        .. code-block:: python

            # Set up your environment
            # https://cloud.google.com/vertex-ai/generative-ai/docs/start/quickstarts/quickstart-multimodal#local-shell

            from phoenix.evals import GeminiModel
            # if necessary, use the "project" kwarg to specify the project_id to use
            # project_id = "your-project-id"
            model = GeminiModel(model="gemini-pro", project=project_id)
    """

    # The vertex SDK runs into connection pool limits at high concurrency
    project: Optional[str] = None
    location: Optional[str] = None
    credentials: Optional["Credentials"] = None

    default_concurrency: int = 5

    model: str = "gemini-pro"
    temperature: float = 0.0
    max_tokens: int = 1024
    top_p: float = 1
    top_k: int = 32
    stop_sequences: List[str] = field(default_factory=list)
    initial_rate_limit: int = 5
    timeout: int = 120
    model_kwargs: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self._init_client()
        self._init_vertex_ai()
        self._init_rate_limiter()

    @property
    def _model_name(self) -> str:
        return self.model

    def reload_client(self) -> None:
        self._init_client()

    def _init_client(self) -> None:
        try:
            import vertexai  # type:ignore
            from google.api_core import exceptions
            from vertexai.preview import generative_models as vertex  # type:ignore

            self._vertexai = vertexai
            self._vertex = vertex
            self._gcp_exceptions = exceptions
            self._model = self._vertex.GenerativeModel(self.model, **self.model_kwargs)
        except ImportError:
            self._raise_import_error(
                package_name="vertexai",
            )

    def _init_vertex_ai(self) -> None:
        self._vertexai.init(**self._init_params)

    def _init_rate_limiter(self) -> None:
        self._rate_limiter = RateLimiter(
            rate_limit_error=self._gcp_exceptions.ResourceExhausted,
            max_rate_limit_retries=10,
            initial_per_second_request_rate=self.initial_rate_limit,
            enforcement_window_minutes=1,
        )

    @property
    def generation_config(self) -> Dict[str, Any]:
        return {
            "temperature": self.temperature,
            "max_output_tokens": self.max_tokens,
            "top_p": self.top_p,
            "top_k": self.top_k,
            "stop_sequences": self.stop_sequences,
        }

    @property
    def _init_params(self) -> Dict[str, Any]:
        return {
            "project": self.project,
            "location": self.location,
            "credentials": self.credentials,
        }

    def _generate(self, prompt: Union[str, MultimodalPrompt], **kwargs: Dict[str, Any]) -> str:
        # instruction is an invalid input to Gemini models, it is passed in by
        # BaseEvalModel.__call__ and needs to be removed
        kwargs.pop("instruction", None)

        if isinstance(prompt, str):
            prompt = MultimodalPrompt.from_string(prompt)

        @self._rate_limiter.limit
        def _rate_limited_completion(
            prompt: MultimodalPrompt, generation_config: Dict[str, Any], **kwargs: Any
        ) -> Any:
            prompt_str = self._construct_prompt(prompt)
            response = self._model.generate_content(
                contents=prompt_str, generation_config=generation_config, **kwargs
            )
            return self._parse_response_candidates(response)

        response = _rate_limited_completion(
            prompt=prompt,
            generation_config=self.generation_config,
            **kwargs,
        )

        return str(response)

    async def _async_generate(
        self, prompt: Union[str, MultimodalPrompt], **kwargs: Dict[str, Any]
    ) -> str:
        # instruction is an invalid input to Gemini models, it is passed in by
        # BaseEvalModel.__call__ and needs to be removed
        kwargs.pop("instruction", None)

        if isinstance(prompt, str):
            prompt = MultimodalPrompt.from_string(prompt)

        @self._rate_limiter.alimit
        async def _rate_limited_completion(
            prompt: MultimodalPrompt, generation_config: Dict[str, Any], **kwargs: Any
        ) -> Any:
            prompt_str = self._construct_prompt(prompt)
            response = await self._model.generate_content_async(
                contents=prompt_str, generation_config=generation_config, **kwargs
            )
            return self._parse_response_candidates(response)

        response = await _rate_limited_completion(
            prompt=prompt,
            generation_config=self.generation_config,
            **kwargs,
        )

        return str(response)

    def _parse_response_candidates(self, response: Any) -> Any:
        if hasattr(response, "candidates"):
            if isinstance(response.candidates, list) and len(response.candidates) > 0:
                try:
                    candidate = response.candidates[0].text
                except ValueError:
                    printif(
                        self._verbose, "The 'candidates' object does not have a 'text' attribute."
                    )
                    printif(self._verbose, str(response.candidates[0]))
                    candidate = ""
            else:
                printif(
                    self._verbose,
                    "The 'candidates' attribute of 'response' is either not a list or is empty.",
                )
                printif(self._verbose, str(response))
                candidate = ""
        else:
            printif(self._verbose, "The 'response' object does not have a 'candidates' attribute.")
            candidate = ""
        return candidate

    def _construct_prompt(self, prompt: MultimodalPrompt) -> str:
        return prompt.to_text_only_prompt()
