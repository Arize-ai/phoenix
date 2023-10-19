import logging
from abc import ABC, abstractmethod, abstractproperty
from contextlib import contextmanager
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Callable, Generator, List, Optional, Type

if TYPE_CHECKING:
    from tiktoken import Encoding

from tenacity import (
    RetryCallState,
    retry,
    retry_base,
    retry_if_exception_type,
    stop_after_attempt,
    wait_random_exponential,
)
from tqdm import tqdm
from tqdm.asyncio import tqdm_asyncio

from phoenix.experimental.evals.utils.threads import to_thread
from phoenix.experimental.evals.utils.types import is_list_of
from phoenix.utilities.logging import printif

logger = logging.getLogger(__name__)

TQDM_BAR_FORMAT = (
    "Eta:{eta} |{bar}| {percentage:3.1f}% "
    "({n_fmt}/{total_fmt}) "
    "[{elapsed}<{remaining}, {rate_fmt}{postfix}]"
)


@contextmanager
def set_verbosity(
    model: "BaseEvalModel", verbose: bool = False
) -> Generator["BaseEvalModel", None, None]:
    try:
        _verbose = model._verbose
        model._verbose = verbose
        yield model
    finally:
        model._verbose = _verbose


@dataclass
class Response:
    text: str


@dataclass
class BaseEvalModel(ABC):
    _verbose: bool = False

    def retry(
        self,
        error_types: List[Type[BaseException]],
        min_seconds: int,
        max_seconds: int,
        max_retries: int,
    ) -> Callable[[Any], Any]:
        """Create a retry decorator for a given LLM and provided list of error types."""

        def log_retry(retry_state: RetryCallState) -> None:
            if fut := retry_state.outcome:
                exc = fut.exception()
            else:
                exc = None

            if exc:
                printif(
                    self._verbose,
                    f"Failed attempt {retry_state.attempt_number}: raised {repr(exc)}",
                )
            else:
                printif(self._verbose, f"Failed attempt {retry_state.attempt_number}")
            return None

        retry_instance: retry_base = retry_if_exception_type(error_types[0])
        for error in error_types[1:]:
            retry_instance = retry_instance | retry_if_exception_type(error)
        return retry(
            reraise=True,
            stop=stop_after_attempt(max_retries),
            wait=wait_random_exponential(multiplier=1, min=min_seconds, max=max_seconds),
            retry=retry_instance,
            before_sleep=log_retry,
        )

    def __call__(self, prompt: str, instruction: Optional[str] = None) -> str:
        """Run the LLM on the given prompt."""
        if not isinstance(prompt, str):
            raise TypeError(
                "Invalid type for argument `prompt`. Expected a string but found "
                f"{type(prompt)}. If you want to run the LLM on multiple prompts, use "
                "`generate` instead."
            )
        if instruction is not None and not isinstance(instruction, str):
            raise TypeError(
                "Invalid type for argument `instruction`. Expected a string but found "
                f"{type(instruction)}."
            )
        return self.generate(prompts=[prompt], instruction=instruction)[0].text

    async def async_call(self, prompt: str, instruction: Optional[str] = None) -> str:
        """Run the LLM on the given prompt."""
        if not isinstance(prompt, str):
            raise TypeError(
                "Invalid type for argument `prompt`. Expected a string but found "
                f"{type(prompt)}. If you want to run the LLM on multiple prompts, use "
                "`generate` instead."
            )
        if instruction is not None and not isinstance(instruction, str):
            raise TypeError(
                "Invalid type for argument `instruction`. Expected a string but found "
                f"{type(instruction)}."
            )
        response = await self.agenerate(prompts=[prompt], instruction=instruction)
        return response[0]

    def generate(
        self, prompts: List[str], instruction: Optional[str] = None, **kwargs: Any
    ) -> List[Response]:
        printif(self._verbose, f"Generating responses for {len(prompts)} prompts...")
        if extra_info := self._verbose_generation_info():
            printif(self._verbose, extra_info)
        if not is_list_of(prompts, str):
            raise TypeError(
                "Invalid type for argument `prompts`. Expected a list of strings "
                f"but found {type(prompts)}."
            )
        try:
            outputs = []
            for prompt in tqdm(prompts, bar_format=TQDM_BAR_FORMAT, ncols=100):
                output = self._generate(prompt=prompt, instruction=instruction, **kwargs)
                logger.info(f"Prompt: {prompt}\nInstruction: {instruction}\nOutput: {output}")
                outputs.append(output)

        except (KeyboardInterrupt, Exception) as e:
            raise e
        return outputs

    async def agenerate(self, prompts: List[str], instruction: Optional[str] = None) -> List[str]:
        if not is_list_of(prompts, str):
            raise TypeError(
                "Invalid type for argument `prompts`. Expected a list of strings "
                f"but found {type(prompts)}."
            )
        try:
            result: List[str] = await tqdm_asyncio.gather(
                *[self._agenerate(prompt=prompt, instruction=instruction) for prompt in prompts],
                bar_format=TQDM_BAR_FORMAT,
                ncols=100,
            )
        except (KeyboardInterrupt, Exception) as e:
            raise e
        return result

    def _verbose_generation_info(self) -> str:
        # if defined, returns additional model-specific information to display if `generate` is
        # run with `verbose=True`
        return ""

    @abstractmethod
    def _generate(self, prompt: str, **kwargs: Any) -> Response:
        raise NotImplementedError

    async def _agenerate(self, prompt: str, instruction: Optional[str]) -> str:
        return str(await to_thread(self._generate, prompt=prompt, instruction=instruction))

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

    @abstractmethod
    def get_tokens_from_text(self, text: str) -> List[int]:
        ...

    @abstractmethod
    def get_text_from_tokens(self, tokens: List[int]) -> str:
        ...

    @abstractproperty
    def max_context_size(self) -> int:
        ...

    @abstractproperty
    def encoder(self) -> "Encoding":
        ...
