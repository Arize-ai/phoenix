import base64
import logging
import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from urllib.parse import urlparse

import requests

from phoenix.evals.exceptions import (
    PhoenixUnsupportedAudioFormat,
    PhoenixUnsupportedImageFormat,
)
from phoenix.evals.models.base import BaseModel
from phoenix.evals.models.rate_limiters import RateLimiter
from phoenix.evals.templates import MultimodalPrompt, PromptPartContentType
from phoenix.evals.utils import (
    get_audio_format_from_base64,
    get_image_format_from_base64,
)

MINIMUM_GOOGLE_GENAI_VERSION = "1.0.0"
DEFAULT_GOOGLE_GENAI_MODEL = "gemini-2.5-flash"
SUPPORTED_AUDIO_FORMATS = {
    "wav",
    "mp3",
    "aiff",
    "aac",
    "ogg",
    "flac",
}  # ref: https://ai.google.dev/gemini-api/docs/audio#supported-formats
SUPPORTED_IMAGE_FORMATS = {
    "png",
    "jpeg",
    "webp",
    "heic",
    "heif",
}  # ref: https://ai.google.dev/gemini-api/docs/image-understanding#supported-formats

logger = logging.getLogger(__name__)


class GoogleRateLimitError(Exception):
    pass


def _get_env_api_key() -> Optional[str]:
    """Gets the API key from environment variables, prioritizing GOOGLE_API_KEY.

    Returns:
        The API key string if found, otherwise None. Empty string is considered
        invalid.
    """
    env_google_api_key = os.environ.get("GOOGLE_API_KEY", None)
    env_gemini_api_key = os.environ.get("GEMINI_API_KEY", None)
    if env_google_api_key and env_gemini_api_key:
        logger.warning("Both GOOGLE_API_KEY and GEMINI_API_KEY are set. Using" " GOOGLE_API_KEY.")

    return env_google_api_key or env_gemini_api_key or None


@dataclass
class GoogleAIModel(BaseModel):
    """
    An interface for using Google Gemini models.

    This class wraps the Google GenAI SDK for use with Phoenix LLM evaluations. Calls to the
    Google GenAI API are dynamically throttled when encountering rate limit errors. Requires the
    `google-genai` package to be installed.

    Supports Async: ✅
        If possible, makes LLM calls concurrently.

    Args:
        model (str, optional): The model name to use. Defaults to "gemini-2.5-flash".
        api_key (str, optional): Your Google key. If not provided, will be read from the
            environment variable. Defaults to None.
        initial_rate_limit (int, optional): The initial internal rate limit in allowed requests
            per second for making LLM calls. This limit adjusts dynamically based on rate
            limit errors. Defaults to 5.

    Example:
        .. code-block:: python

            # Get your own Google API Key: https://aistudio.google.com/apikey
            # Set the GOOGLE_API_KEY environment variable

            from phoenix.evals import GoogleAIModel
            model = GoogleAIModel(model="gemini-2.5-flash")
    """

    model: str = DEFAULT_GOOGLE_GENAI_MODEL
    api_key: Optional[str] = None
    initial_rate_limit: int = 5

    def __post_init__(self) -> None:
        if self.api_key is None:
            self.api_key = _get_env_api_key()
        self._init_client()
        self._init_rate_limiter()

    @property
    def _model_name(self) -> str:
        return self.model

    def _init_rate_limiter(self) -> None:
        self._rate_limiter = RateLimiter(
            rate_limit_error=GoogleRateLimitError,
            max_rate_limit_retries=10,
            initial_per_second_request_rate=self.initial_rate_limit,
            enforcement_window_minutes=1,
        )

    def _init_client(self) -> None:
        try:
            from google import genai
            from google.genai import types
            from google.genai.errors import APIError
        except ImportError:
            self._raise_import_error(
                package_name="google-genai",
                package_min_version=MINIMUM_GOOGLE_GENAI_VERSION,
            )
        self._google_types = types
        self._client = genai.Client(api_key=self.api_key)
        self._google_sdk_error = APIError

    async def _async_generate(
        self,
        prompt: Union[str, MultimodalPrompt],
        instruction: Optional[str] = None,
        **kwargs: Dict[str, Any],
    ) -> str:
        if isinstance(prompt, str):
            prompt = MultimodalPrompt.from_string(prompt)
        config = self._google_types.GenerateContentConfig(system_instruction=instruction, **kwargs)
        response = self._async_rate_limited_completion(
            model=self.model,
            contents=self._process_prompt(prompt=prompt),
            config=config,
        )

        return str(response)

    async def _async_rate_limited_completion(self, **kwargs: Any) -> Any:
        @self._rate_limiter.alimit
        async def _async_completion(**kwargs: Any) -> Any:
            try:
                response = await self._client.aio.models.generate_content(**kwargs)
                return response.text
            except self._google_sdk_error as e:
                raise e

        return await _async_completion(**kwargs)

    def _generate(
        self,
        prompt: Union[str, MultimodalPrompt],
        instruction: Optional[str] = None,
        **kwargs: Dict[str, Any],
    ) -> str:
        if isinstance(prompt, str):
            prompt = MultimodalPrompt.from_string(prompt)
        config = self._google_types.GenerateContentConfig(system_instruction=instruction, **kwargs)
        response = self._rate_limited_completion(
            model=self.model,
            contents=self._process_prompt(prompt=prompt),
            config=config,
        )

        return str(response)

    def _rate_limited_completion(self, **kwargs: Any) -> Any:
        @self._rate_limiter.limit
        def _completion(**kwargs: Any) -> Any:
            try:
                response = self._client.models.generate_content(**kwargs)
                return response.text
            except self._google_sdk_error as e:
                raise e

        return _completion(**kwargs)

    def _process_prompt(self, prompt: MultimodalPrompt) -> List[Dict[str, Any]]:
        contents: List[Dict[str, Any]] = []
        for part in prompt.parts:
            if part.content_type == PromptPartContentType.TEXT:
                contents.append({"parts": [{"text": part.content}]})
            elif part.content_type == PromptPartContentType.IMAGE:
                content = part.content

                if _is_url(content):
                    try:
                        raw_image_bytes = requests.get(content).content
                        content = base64.b64encode(raw_image_bytes).decode()
                    except requests.RequestException as e:
                        raise e
                else:
                    raw_image_bytes = base64.b64decode(content)

                format = str(get_image_format_from_base64(content))

                if format not in SUPPORTED_IMAGE_FORMATS:
                    raise PhoenixUnsupportedImageFormat(f"Unsupported image format: {format}")

                contents.append(
                    {
                        "parts": [
                            {
                                "inline_data": {
                                    "data": raw_image_bytes,
                                    "mime_type": f"image/{format}",
                                }
                            }
                        ]
                    }
                )
            elif part.content_type == PromptPartContentType.AUDIO:
                format = str(get_audio_format_from_base64(part.content))
                if format not in SUPPORTED_AUDIO_FORMATS:
                    raise PhoenixUnsupportedAudioFormat(f"Unsupported audio format: {format}")

                raw_audio_bytes = base64.b64decode(part.content)
                contents.append(
                    {
                        "parts": [
                            {
                                "inline_data": {
                                    "data": raw_audio_bytes,
                                    "mime_type": f"audio/{format}",
                                }
                            }
                        ]
                    }
                )
            else:
                raise ValueError(
                    f"Unsupported content type for {GoogleAIModel.__name__}: {part.content_type}"
                )
        return contents


def _is_url(url: str) -> bool:
    parsed_url = urlparse(url)
    return bool(parsed_url.scheme and parsed_url.netloc)


def _is_base64(s: str) -> bool:
    try:
        base64.b64decode(s, validate=True)
        return True
    except Exception:
        return False
