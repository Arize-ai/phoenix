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
            },
            instance._resource.schema_url,
        )

    return wrapper


class using_project:
    """
    A context manager that switches the project for all spans created within the context.

    This is intended for use in notebook environments where it's useful to be able to change the
    project associated with spans on the fly.

    Note: This should not be used in production environments or complex OpenTelemetry setups.
    As dynamically modifying span resources in this way can lead to unexpected behavior.

    Args:
        project_name (str): The project name to associate with spans created within the context.

    Examples:
        with using_project('my_project'):
            # Spans created here will be associated with 'my_project'
            ...
    """

    def __init__(self, project_name: str) -> None:
        self.project_name = project_name

    def __enter__(self) -> None:
        self.unwrapped_init: Optional[Callable[..., None]] = trace.ReadableSpan.__init__
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
        self.unwrapped_init = None
