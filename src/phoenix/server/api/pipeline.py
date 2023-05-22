import threading
from abc import abstractmethod
from dataclasses import dataclass, field
from typing import (
    Any,
    Generic,
    Iterator,
    List,
    Optional,
    TypeVar,
    cast,
)

from typing_extensions import ParamSpec

from phoenix.core.model_schema import Model

_Steps = ParamSpec("_Steps")
_Parameters = TypeVar("_Parameters")
_Input = TypeVar("_Input")
_Output = TypeVar("_Output", covariant=True)


@dataclass(frozen=True)
class Step(Generic[_Parameters, _Input, _Output]):
    """CAVEAT: Each Step must not mutate its input because it might be the
    output of a previous step that has been cached for reuse. If we change
    it, it won't be valid when we try to use it again.
    """

    parameters: _Parameters

    @abstractmethod
    def __call__(self, data: _Input) -> _Output:
        ...


@dataclass(frozen=True)
class Pipeline(Generic[_Input, _Steps, _Output]):
    steps: _Steps.args

    def __init__(
        self,
        *steps: _Steps.args,
        **_: _Steps.kwargs,
    ) -> None:
        assert len(steps) > 0
        object.__setattr__(self, "steps", steps)

    def __len__(self) -> int:
        return len(self.steps)

    def __call__(
        self,
        data: Any,
        start: Optional[int] = None,
        stop: Optional[int] = None,
    ) -> Iterator[Any]:
        for step in self.steps[slice(start, stop)]:
            data = step(data)
            yield data


@dataclass(repr=False)
class ModelPlumberWithCache(Generic[_Steps, _Output]):
    """Plumber extraordinaire, very flush"""

    model: Model
    _pipeline: Optional[Pipeline[Model, _Steps, _Output]] = field(
        init=False,
        default=None,
    )
    _outputs: List[Any] = field(
        init=False,
        default_factory=list,
    )
    _lock: threading.Lock = field(
        init=False,
        default_factory=threading.Lock,
    )

    def __call__(
        self,
        pipeline: Pipeline[_Input, _Steps, _Output],
    ) -> _Output:
        with self._lock:
            if self._pipeline is None:
                self._outputs = list(pipeline(self.model))
            else:
                assert 0 < len(pipeline) == len(self._pipeline)
                for start, (new, old) in enumerate(
                    zip(
                        pipeline.steps,
                        self._pipeline.steps,
                    )
                ):
                    assert type(new.parameters) is type(old.parameters)  # noqa E721
                    if new.parameters != old.parameters:
                        self._outputs[start:] = pipeline(
                            self._outputs[start - 1] if start else self.model,
                            start,
                        )
                        break
            self._pipeline = pipeline  # type: ignore
            return cast(_Output, self._outputs[-1])
