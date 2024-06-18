import inspect
import logging
import random
from contextlib import ExitStack, contextmanager
from contextvars import ContextVar
from datetime import datetime, timezone
from threading import RLock
from typing import (
    Any,
    Awaitable,
    Callable,
    Dict,
    Iterator,
    List,
    Mapping,
    Optional,
    Tuple,
    TypedDict,
    TypeVar,
    Union,
    cast,
)

import wrapt
from typing_extensions import TypeAlias
from wrapt import resolve_path, wrap_function_wrapper

from phoenix.datasets.jsonify import jsonify
from phoenix.datasets.types import Example, ExecutionConfig, ExecutionResult, ExperimentResult

logger = logging.getLogger(__name__)


class _ExecutionStep(TypedDict, total=False):
    id: str
    result: Optional[Dict[str, Any]]
    intermediate_results: Optional[List[ExecutionResult]]
    inputs: Optional[Dict[str, Any]]
    error: Optional[str]


class _ExecutionSequence(List[_ExecutionStep]):
    def __init__(self) -> None:
        super().__init__()
        self._lock = RLock()

    def append(self, res: _ExecutionStep) -> None:
        with self._lock:
            return super().append(res)


_EXECUTION_SEQUENCE: ContextVar[Optional[_ExecutionSequence]] = ContextVar(
    "execution_sequence", default=None
)
_IO_CAPTURE_DECORATED_ATTR_KEY = (
    f"__io_capture_decorated_{random.getrandbits(16).to_bytes(2, 'big').hex()}__"
)


class io_capture:
    def __init__(
        self,
        *,
        identifier: Optional[str] = None,
        transform_inputs: Optional[Callable[..., Any]] = None,
        transform_output: Callable[..., Any] = jsonify,
    ) -> None:
        self._identifier = identifier
        self._transform_inputs = transform_inputs
        self._transform_output = transform_output

    def __call__(self, fn: Callable[..., Any]) -> Callable[..., Any]:
        # `_self_` is needed because we want to find attribute on the wrapper.
        # See https://github.com/GrahamDumpleton/wrapt/blob/5c0997c0b5be36da5f621c3473c95f9efe14891e/src/wrapt/wrappers.py#L168-L169  # noqa: E501
        if hasattr(fn, "__dict__") and fn.__dict__.get(f"_self_{_IO_CAPTURE_DECORATED_ATTR_KEY}"):
            return fn

        if inspect.iscoroutinefunction(fn):
            wrapper_wrapped = wrapt.decorator(self.async_wrapper)(fn)
        else:
            wrapper_wrapped = wrapt.decorator(self.sync_wrapper)(fn)

        # `_self_` is needed because we want to set attribute on the wrapper.
        # See https://github.com/GrahamDumpleton/wrapt/blob/5c0997c0b5be36da5f621c3473c95f9efe14891e/src/wrapt/wrappers.py#L168-L169  # noqa: E501
        setattr(wrapper_wrapped, f"_self_{_IO_CAPTURE_DECORATED_ATTR_KEY}", True)

        return cast(Callable[..., Any], wrapper_wrapped)

    async def async_wrapper(
        self,
        wrapped: Callable[..., Any],
        instance: object,
        args: Tuple[Any, ...],
        kwargs: Mapping[str, Any],
    ) -> Any:
        seq = _EXECUTION_SEQUENCE.get()
        if not isinstance(seq, list):
            return await wrapped(*args, **kwargs)
        with self._new_step(seq, wrapped, instance, args, kwargs) as step:
            try:
                ans = await wrapped(*args, **kwargs)
            except BaseException as e:
                step["error"] = str(e)
                raise
            try:
                if inspect.iscoroutinefunction(self._transform_output):
                    result = await self._transform_output(ans)
                else:
                    result = self._transform_output(ans)
            except BaseException as e:
                logger.exception(str(e))
                result = str(ans)
            step["result"] = result
            return ans

    def sync_wrapper(
        self,
        wrapped: Callable[..., Any],
        instance: object,
        args: Tuple[Any, ...],
        kwargs: Mapping[str, Any],
    ) -> Any:
        seq = _EXECUTION_SEQUENCE.get()
        if not isinstance(seq, list):
            return wrapped(*args, **kwargs)
        with self._new_step(seq, wrapped, instance, args, kwargs) as step:
            try:
                ans = wrapped(*args, **kwargs)
            except BaseException as e:
                step["error"] = str(e)
                raise
            try:
                result = self._transform_output(ans)
            except BaseException as e:
                logger.exception(str(e))
                result = str(ans)
            step["result"] = result
            return ans

    @contextmanager
    def _new_step(
        self,
        seq: _ExecutionSequence,
        wrapped: Callable[..., Any],
        instance: object,
        args: Tuple[Any, ...],
        kwargs: Mapping[str, Any],
    ) -> Iterator[_ExecutionStep]:
        step = _ExecutionStep(id=self._get_id(wrapped, instance))
        seq.append(step)
        if self._transform_inputs:
            try:
                step["inputs"] = self._transform_inputs(*args, **kwargs)
            except BaseException as e:
                logger.exception(str(e))
        child_seq = _ExecutionSequence()
        token = _EXECUTION_SEQUENCE.set(child_seq)
        yield step
        _EXECUTION_SEQUENCE.reset(token)
        if child_seq:
            step["intermediate_results"] = list(map(ExecutionResult.from_dict, child_seq))

    def _get_id(self, wrapped: Any, instance: Any) -> str:
        if self._identifier is not None:
            return self._identifier
        if not hasattr(wrapped, "__name__"):
            return repr(wrapped)
        if instance is None or not hasattr(instance, "__class__"):
            return f"{wrapped.__name__}"
        cls = instance.__class__
        return f"{cls.__module__}.{cls.__name__}.{wrapped.__name__}"


StartTime: TypeAlias = datetime
EndTime: TypeAlias = datetime

T = TypeVar("T")


def capture_experiment_result(
    wrapped: Union[Callable[[Example], T], Callable[[Example], Awaitable[T]]],
    on_finish: Callable[[ExperimentResult], None],
) -> Callable[[Example], T]:
    wrapped = io_capture()(wrapped)

    @wrapt.decorator  # type: ignore
    async def _async_wrapper(
        fn: Callable[[Example], Awaitable[T]],
        _: Any,
        args: Tuple[Example],
        __: Any,
    ) -> T:
        seq = _ExecutionSequence()
        token = _EXECUTION_SEQUENCE.set(seq)
        start_time = datetime.now(timezone.utc)
        try:
            return await fn(args[0])
        finally:
            end_time = datetime.now(timezone.utc)
            result = ExperimentResult(
                execution_result=ExecutionResult.from_dict(seq.pop()),
                start_time=start_time,
                end_time=end_time,
            )
            on_finish(result)
            _EXECUTION_SEQUENCE.reset(token)

    @wrapt.decorator  # type: ignore
    def _sync_wrapper(
        fn: Callable[[Example], T],
        _: Any,
        args: Tuple[Example],
        __: Any,
    ) -> T:
        seq = _ExecutionSequence()
        token = _EXECUTION_SEQUENCE.set(seq)
        start_time = datetime.now(timezone.utc)
        try:
            return fn(args[0])
        finally:
            end_time = datetime.now(timezone.utc)
            result = ExperimentResult(
                execution_result=ExecutionResult.from_dict(seq.pop()),
                start_time=start_time,
                end_time=end_time,
            )
            on_finish(result)
            _EXECUTION_SEQUENCE.reset(token)

    if inspect.iscoroutinefunction(wrapped):
        wrapper_wrapped = _async_wrapper(wrapped)
    else:
        wrapper_wrapped = _sync_wrapper(wrapped)
    return cast(Callable[[Example], T], wrapper_wrapped)


@contextmanager
def monkey_patch(patches: Dict[Callable[..., Any], ExecutionConfig]) -> Iterator[None]:
    with ExitStack() as stack:
        for k, v in patches.items():
            stack.enter_context(_patch(k, v))
        yield


@contextmanager
def _patch(f: Callable[..., Any], config: ExecutionConfig) -> Iterator[None]:
    module, name = f.__module__, f.__qualname__
    (parent, attribute, original) = resolve_path(module, name)
    wrapper = io_capture(**config).sync_wrapper
    wrap_function_wrapper(module=module, name=name, wrapper=wrapper)
    yield
    setattr(parent, attribute, original)
