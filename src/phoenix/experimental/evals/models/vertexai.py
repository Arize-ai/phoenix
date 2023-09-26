from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Dict, Optional

from .base import BaseEvalModel, create_base_retry_decorator

if TYPE_CHECKING:
    from google.auth.credentials import Credentials  # type:ignore


MINIMUM_VERTEX_AI_VERSION = "1.33.0"


@dataclass
class VertexAIModel(BaseEvalModel):
    project: Optional[str] = None
    "project (str): The default project to use when making API calls."
    location: Optional[str] = None
    "location (str): The default location to use when making API calls. If not "
    "set defaults to us-central-1."
    credentials: Optional["Credentials"] = None
    model_name: str = "text-bison"
    tuned_model_name: Optional[str] = None
    "The name of a tuned model. If provided, model_name is ignored."
    max_retries: int = 6
    """Maximum number of retries to make when generating."""
    retry_min_seconds: int = 10
    """Minimum number of seconds to wait when retrying."""
    retry_max_seconds: int = 60
    """Maximum number of seconds to wait when retrying."""
    temperature: float = 0.0
    """What sampling temperature to use."""
    max_tokens: int = 256
    """The maximum number of tokens to generate in the completion.
    -1 returns as many tokens as possible given the prompt and
    the models maximal context size."""
    top_p: float = 0.95
    "Tokens are selected from most probable to least until the sum of their "
    "probabilities equals the top-p value. Top-p is ignored for Codey models."
    top_k: int = 40
    "How the model selects tokens for output, the next token is selected from "
    "among the top-k most probable tokens. Top-k is ignored for Codey models."

    def __post_init__(self) -> None:
        self._init_environment()
        self._init_vertex_ai()
        self._instantiate_model()

    def _init_environment(self) -> None:
        try:
            import google.api_core.exceptions as google_exceptions  # type:ignore
            import vertexai  # type:ignore

            self._vertexai = vertexai
            self._google_exceptions = google_exceptions
        except ImportError:
            self._raise_import_error(
                package_display_name="VertexAI",
                package_name="google-cloud-aiplatform",
                package_min_version=MINIMUM_VERTEX_AI_VERSION,
            )

    def _init_vertex_ai(self) -> None:
        self._vertexai.init(**self._init_params)

    def _instantiate_model(self) -> None:
        if self.is_codey_model:
            from vertexai.preview.language_models import CodeGenerationModel  # type:ignore

            model = CodeGenerationModel
        else:
            from vertexai.preview.language_models import TextGenerationModel

            model = TextGenerationModel

        if self.tuned_model_name:
            self._model = model.get_tuned_model(self.tuned_model_name)
        else:
            self._model = model.from_pretrained(self.model_name)

    def _generate(self, prompt: str, **kwargs: Dict[str, Any]) -> str:
        invoke_params = self.invocation_params
        response = self._generate_with_retry(
            prompt=prompt,
            **invoke_params,
        )
        return str(response.text)

    def _generate_with_retry(self, **kwargs: Any) -> Any:
        """Use tenacity to retry the completion call."""
        google_api_retry_errors = [
            self._google_exceptions.ResourceExhausted,
            self._google_exceptions.ServiceUnavailable,
            self._google_exceptions.Aborted,
            self._google_exceptions.DeadlineExceeded,
        ]
        retry_decorator = create_base_retry_decorator(
            error_types=google_api_retry_errors,
            min_seconds=self.retry_min_seconds,
            max_seconds=self.retry_max_seconds,
            max_retries=self.max_retries,
        )

        @retry_decorator
        def _completion_with_retry(**kwargs: Any) -> Any:
            return self._model.predict(**kwargs)

        return _completion_with_retry(**kwargs)

    @property
    def is_codey_model(self) -> bool:
        return is_codey_model(self.tuned_model_name or self.model_name)

    @property
    def _init_params(self) -> Dict[str, Any]:
        return {
            "project": self.project,
            "location": self.location,
            "credentials": self.credentials,
        }

    @property
    def invocation_params(self) -> Dict[str, Any]:
        params = {
            "temperature": self.temperature,
            "max_output_tokens": self.max_tokens,
        }
        if self.is_codey_model:
            return params
        else:
            return {
                **params,
                "top_k": self.top_k,
                "top_p": self.top_p,
            }


def is_codey_model(model_name: str) -> bool:
    """Returns True if the model name is a Codey model.

    Args:
        model_name: The model name to check.

    Returns: True if the model name is a Codey model.
    """
    return "code" in model_name
