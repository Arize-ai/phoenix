from typing import Any

from openinference.instrumentation.anthropic import AnthropicInstrumentor
from openinference.instrumentation.anthropic._wrappers import _MessagesWrapper
from wrapt import wrap_function_wrapper


# Our default instrumentor does not capture computer use, so we are using a Beta version which adds support for computer use.
class AnthropicBetaInstrumentor(AnthropicInstrumentor):
    def _instrument(self, **kwargs: Any) -> None:
        super(AnthropicBetaInstrumentor, self)._instrument()
        from anthropic.resources.beta.messages import Messages

        self._original_beta_messages_create = Messages.create
        wrap_function_wrapper(
            module="anthropic.resources.beta.messages",
            name="Messages.create",
            wrapper=_MessagesWrapper(tracer=self._tracer),
        )

    def _uninstrument(self, **kwargs: Any) -> None:
        super(AnthropicBetaInstrumentor, self)._uninstrument()
        from anthropic.resources.beta.messages import Messages

        if (
            hasattr(self, "_original_beta_messages_create")
            and self._original_beta_messages_create is not None
        ):
            Messages.create = self._original_beta_messages_create  # type: ignore[method-assign]
