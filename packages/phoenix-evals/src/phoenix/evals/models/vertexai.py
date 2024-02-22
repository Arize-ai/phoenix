import logging
import warnings
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Dict, Optional

from phoenix.evals.models.base import BaseModel

if TYPE_CHECKING:
    from google.auth.credentials import Credentials  # type:ignore

logger = logging.getLogger(__name__)

MINIMUM_VERTEX_AI_VERSION = "1.33.0"


@dataclass
class VertexAIModel(BaseModel):
    project: Optional[str] = None
    "project (str): The default project to use when making API calls."
    location: Optional[str] = None
    "location (str): The default location to use when making API calls. If not "
    "set defaults to us-central-1."
    credentials: Optional["Credentials"] = None
    model: str = "text-bison"
    tuned_model: Optional[str] = None
    "The name of a tuned model. If provided, model is ignored."
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

    # Deprecated fields
    model_name: Optional[str] = None
    """
    .. deprecated:: 3.0.0
       use `model` instead. This will be removed in a future release.
    """
    tuned_model_name: Optional[str] = None
    """
    .. deprecated:: 3.0.0
       use `tuned_model` instead. This will be removed in a future release.
    """

    def __post_init__(self) -> None:
        self._migrate_model_name()
        self._init_environment()
        self._init_vertex_ai()
        self._instantiate_model()

    @property
    def _model_name(self) -> str:
        return self.tuned_model or self.model

    def _migrate_model_name(self) -> None:
        if self.model_name is not None:
            warning_message = (
                "The `model_name` field is deprecated. Use `model` instead. "
                + "This will be removed in a future release."
            )
            warnings.warn(
                warning_message,
                DeprecationWarning,
            )
            print(warning_message)
            self.model = self.model_name
            self.model_name = None
        if self.tuned_model_name is not None:
            warning_message = (
                "`tuned_model_name` field is deprecated. Use `tuned_model` instead. "
                + "This will be removed in a future release."
            )
            warnings.warn(
                warning_message,
                DeprecationWarning,
            )
            print(warning_message)
            self.tuned_model = self.tuned_model_name
            self.tuned_model_name = None

    def _init_environment(self) -> None:
        try:
            import google.api_core.exceptions as google_exceptions
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

        if self.tuned_model:
            self._model = model.get_tuned_model(self.tuned_model)
        else:
            self._model = model.from_pretrained(self.model)

    def verbose_generation_info(self) -> str:
        return f"VertexAI invocation parameters: {self.invocation_params}"

    async def _async_generate(self, prompt: str, **kwargs: Dict[str, Any]) -> str:
        return self._generate(prompt, **kwargs)

    def _generate(self, prompt: str, **kwargs: Dict[str, Any]) -> str:
        invoke_params = self.invocation_params
        response = self._model.predict(
            prompt=prompt,
            **invoke_params,
        )
        return str(response.text)

    @property
    def is_codey_model(self) -> bool:
        return is_codey_model(self.tuned_model or self.model)

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
