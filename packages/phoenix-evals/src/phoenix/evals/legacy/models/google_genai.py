import base64
import json
import logging
import os
import socket
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Tuple, Union, cast
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import urlopen

from typing_extensions import override

from phoenix.evals.exceptions import (
    PhoenixUnsupportedAudioFormat,
    PhoenixUnsupportedImageFormat,
)
from phoenix.evals.legacy.models.base import BaseModel, ExtraInfo, Usage
from phoenix.evals.legacy.models.rate_limiters import RateLimiter
from phoenix.evals.legacy.templates import MultimodalPrompt, PromptPartContentType
from phoenix.evals.legacy.utils import (
    get_audio_format_from_base64,
    get_image_format_from_base64,
)

if TYPE_CHECKING:
    from google.auth.credentials import Credentials
    from google.genai.types import GenerateContentResponse, GenerateContentResponseUsageMetadata

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
        logger.warning("Both GOOGLE_API_KEY and GEMINI_API_KEY are set. Using GOOGLE_API_KEY.")

    return env_google_api_key or env_gemini_api_key or None


@dataclass
class GoogleGenAIModel(BaseModel):
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
        After setting the GOOGLE_API_KEY environment variable:
        .. code-block:: python

            # Get your own Google API Key: https://aistudio.google.com/apikey
            # Set the GOOGLE_API_KEY environment variable

            from phoenix.evals import GoogleAIModel
            model = GoogleAIModel(model="gemini-2.5-flash")

        Using Gemini models via VertexAI can be done like this:

        .. code-block:: python

            from phoenix.evals import GoogleAIModel
            model = GoogleAIModel(
                vertexai=True,
                location=LOCATION,
                project=PROJECT_ID
            )

        It can also be done in a similar way using the credentials.
    """

    model: str = DEFAULT_GOOGLE_GENAI_MODEL
    vertexai: Optional[bool] = None
    api_key: Optional[str] = None
    credentials: Optional["Credentials"] = None
    project: Optional[str] = None
    location: Optional[str] = None
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
            initial_per_second_request_rate=self.initial_rate_limit,
            enforcement_window_minutes=1,
        )

    def _init_client(self) -> None:
        try:
            from google import genai
            from google.genai import types
            from google.genai.errors import ServerError
        except ImportError:
            self._raise_import_error(
                package_name="google-genai",
                package_min_version=MINIMUM_GOOGLE_GENAI_VERSION,
            )
        self._google_types = types
        self._google_sdk_error = ServerError

        if self.vertexai:
            self._client = genai.Client(
                vertexai=self.vertexai,
                credentials=self.credentials,
                project=self.project,
                location=self.location,
            )
            return

        self._client = genai.Client(api_key=self.api_key)

    @override
    async def _async_generate_with_extra(
        self,
        prompt: Union[str, MultimodalPrompt],
        instruction: Optional[str] = None,
        **kwargs: Dict[str, Any],
    ) -> Tuple[str, ExtraInfo]:
        if isinstance(prompt, str):
            prompt = MultimodalPrompt.from_string(prompt)
        config = self._google_types.GenerateContentConfig(system_instruction=instruction, **kwargs)  # type: ignore[arg-type]
        return await self._async_rate_limited_completion(
            model=self.model,
            contents=self._process_prompt(prompt=prompt),
            config=config,
        )

    async def _async_rate_limited_completion(self, **kwargs: Any) -> Tuple[str, ExtraInfo]:
        @self._rate_limiter.alimit
        async def _async_completion(**kwargs: Any) -> Tuple[str, ExtraInfo]:
            try:
                response = await self._client.aio.models.generate_content(**kwargs)
                return self._parse_output(response)
            except self._google_sdk_error as e:
                if e.code == 429:
                    raise GoogleRateLimitError() from e
                raise e

        return await _async_completion(**kwargs)

    @override
    def _generate_with_extra(
        self,
        prompt: Union[str, MultimodalPrompt],
        instruction: Optional[str] = None,
        **kwargs: Dict[str, Any],
    ) -> Tuple[str, ExtraInfo]:
        if isinstance(prompt, str):
            prompt = MultimodalPrompt.from_string(prompt)
        config = self._google_types.GenerateContentConfig(system_instruction=instruction, **kwargs)  # type: ignore[arg-type]
        return self._rate_limited_completion(
            model=self.model,
            contents=self._process_prompt(prompt=prompt),
            config=config,
        )

    def _rate_limited_completion(self, **kwargs: Any) -> Tuple[str, ExtraInfo]:
        @self._rate_limiter.limit
        def _completion(**kwargs: Any) -> Tuple[str, ExtraInfo]:
            try:
                response = self._client.models.generate_content(**kwargs)
                return self._parse_output(response)
            except self._google_sdk_error as e:
                if e.code == 429:
                    raise GoogleRateLimitError() from e
                raise

        return _completion(**kwargs)

    def _extract_text(self, response: "GenerateContentResponse") -> str:
        if function_calls := response.function_calls:
            for function_call in function_calls:
                if args := function_call.args:
                    return json.dumps(args, ensure_ascii=False)
        return response.text or ""

    def _extract_usage(
        self, usage_metadata: Optional["GenerateContentResponseUsageMetadata"]
    ) -> Optional[Usage]:
        if not usage_metadata:
            return None
        prompt_tokens = usage_metadata.prompt_token_count or 0
        completion_tokens = (usage_metadata.candidates_token_count or 0) + (
            usage_metadata.thoughts_token_count or 0
        )
        total_tokens = usage_metadata.total_token_count or 0
        return Usage(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
        )

    def _parse_output(self, response: "GenerateContentResponse") -> Tuple[str, ExtraInfo]:
        text = self._extract_text(response)
        usage = self._extract_usage(response.usage_metadata)
        return text, ExtraInfo(usage=usage)

    def _process_prompt(self, prompt: MultimodalPrompt) -> List[Dict[str, Any]]:
        contents: List[Dict[str, Any]] = []
        for part in prompt.parts:
            if part.content_type == PromptPartContentType.TEXT:
                contents.append({"parts": [{"text": part.content}], "role": "user"})
            elif part.content_type == PromptPartContentType.IMAGE:
                content = part.content

                if _is_url(content):
                    raw_image_bytes = _download_image_from_url(content)
                    content = base64.b64encode(raw_image_bytes).decode()
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
                        ],
                        "role": "user",
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
                        ],
                        "role": "user",
                    }
                )
            else:
                raise ValueError(
                    f"Unsupported content type for {GoogleGenAIModel.__name__}: {part.content_type}"
                )
        return contents


def _download_image_from_url(url: str) -> bytes:
    """
    Download image from URL.

    Args:
        url: The URL to download the image from

    Returns:
        Raw image bytes

    Raises:
        ValueError: If download fails
    """
    try:
        with urlopen(url, timeout=30) as response:
            return cast(bytes, response.read())

    except socket.timeout:
        raise ValueError(f"Timeout fetching image from URL: {url}")
    except (HTTPError, URLError) as e:
        raise ValueError(f"Failed to fetch image from URL: {url}") from e


def _is_url(url: str) -> bool:
    parsed_url = urlparse(url)
    return bool(parsed_url.scheme and parsed_url.netloc)
