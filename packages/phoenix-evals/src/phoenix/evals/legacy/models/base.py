import logging
from abc import ABC, abstractmethod
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any, Generator, NamedTuple, Optional, Sequence, Tuple

from typing_extensions import TypeVar, Union

from phoenix.evals.legacy.models.rate_limiters import RateLimiter
from phoenix.evals.legacy.templates import MultimodalPrompt

T = TypeVar("T", bound=type)


def is_list_of(lst: Sequence[object], tp: T) -> bool:
    return isinstance(lst, list) and all(isinstance(x, tp) for x in lst)


logger = logging.getLogger(__name__)

TQDM_BAR_FORMAT = (
    "Eta:{eta} |{bar}| {percentage:3.1f}% "
    "({n_fmt}/{total_fmt}) "
    "[{elapsed}<{remaining}, {rate_fmt}{postfix}]"
)


@contextmanager
def set_verbosity(model: "BaseModel", verbose: bool = False) -> Generator["BaseModel", None, None]:
    try:
        _model_verbose_setting = model._verbose
        _rate_limiter_verbose_setting = model._rate_limiter._verbose
        model._verbose = verbose
        model._rate_limiter._verbose = verbose
        yield model
    finally:
        model._verbose = _model_verbose_setting
        model._rate_limiter._verbose = _rate_limiter_verbose_setting


class Usage(NamedTuple):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class ExtraInfo(NamedTuple):
    usage: Optional[Usage] = None


@dataclass
class BaseModel(ABC):
    default_concurrency: int = 20
    _verbose: bool = False
    _rate_limiter: RateLimiter = field(default_factory=RateLimiter)

    def __new__(cls, *args: Any, **kwargs: Any) -> "BaseModel":
        assert not args, (
            f"{cls.__name__} instantiation via positional arguments is not allowed. "
            "Please use keyword arguments only."
        )
        return super().__new__(cls)

    @property
    @abstractmethod
    def _model_name(self) -> str:
        """
        A string identifier for the text model being used.
        """
        ...

    @property
    def _timeout(self) -> Optional[int]:
        return getattr(self, "timeout", None)

    def reload_client(self) -> None:
        pass

    def __call__(
        self, prompt: Union[str, MultimodalPrompt], instruction: Optional[str] = None, **kwargs: Any
    ) -> str:
        """Run the LLM on the given prompt."""
        if not isinstance(prompt, (str, MultimodalPrompt)):
            raise TypeError(
                "Invalid type for argument `prompt`. Expected a string or PromptMessages but found "
                f"{type(prompt)}. If you want to run the LLM on multiple prompts, use "
                "`generate` instead."
            )
        if instruction is not None and not isinstance(instruction, str):
            raise TypeError(
                "Invalid type for argument `instruction`. Expected a string but found "
                f"{type(instruction)}."
            )

        return self._generate(prompt=prompt, instruction=instruction, **kwargs)

    def verbose_generation_info(self) -> str:
        # if defined, returns additional model-specific information to display if `generate` is
        # run with `verbose=True`
        return ""

    async def _async_generate(self, prompt: Union[str, MultimodalPrompt], **kwargs: Any) -> str:
        return (await self._async_generate_with_extra(prompt, **kwargs))[0]

    def _generate(self, prompt: Union[str, MultimodalPrompt], **kwargs: Any) -> str:
        return self._generate_with_extra(prompt, **kwargs)[0]

    @abstractmethod
    async def _async_generate_with_extra(
        self, prompt: Union[str, MultimodalPrompt], **kwargs: Any
    ) -> Tuple[str, ExtraInfo]:
        raise NotImplementedError

    @abstractmethod
    def _generate_with_extra(
        self, prompt: Union[str, MultimodalPrompt], **kwargs: Any
    ) -> Tuple[str, ExtraInfo]:
        raise NotImplementedError

    @staticmethod
    def _raise_import_error(
        package_name: str, package_display_name: str = "", package_min_version: str = ""
    ) -> None:
        if not package_display_name:
            package_display_name = package_name
        msg = (
            f"Could not import necessary dependencies to use {package_display_name}. "
            "Please install them with "
        )
        if package_min_version:
            msg += f"`pip install {package_name}>={package_min_version}`."
        else:
            msg += f"`pip install {package_name}`."
        raise ImportError(msg)
