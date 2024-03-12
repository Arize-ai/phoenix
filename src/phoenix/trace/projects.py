import types
from typing import Any, Callable, Optional, Type

from openinference.semconv.resource import ResourceAttributes
from opentelemetry.sdk import trace
from opentelemetry.sdk.resources import Resource
from wrapt import wrap_function_wrapper


def project_override_wrapper(project_name: str) -> Callable[..., None]:
    def wrapper(
        wrapped: Any,
        instance: "trace.ReadableSpan",
        args: Any,
        kwargs: Any,
    ) -> None:
        wrapped(*args, **kwargs)
        instance._resource = Resource(
            {
                **instance._resource.attributes,
                ResourceAttributes.PROJECT_NAME: project_name,
            }
        )

    return wrapper


class enable_tracing:
    def __init__(self, project_name: str) -> None:
        self.project_name = project_name

    def __enter__(self) -> None:
        self.unwrapped_init = trace.ReadableSpan.__init__
        wrap_function_wrapper(
            module="opentelemetry.sdk.trace",
            name="ReadableSpan.__init__",
            wrapper=project_override_wrapper(self.project_name),
        )

    def __exit__(
        self,
        exc_type: Optional[Type[BaseException]],
        exc_value: Optional[BaseException],
        traceback: Optional[types.TracebackType],
    ) -> None:
        setattr(trace.ReadableSpan, "__init__", self.unwrapped_init)
