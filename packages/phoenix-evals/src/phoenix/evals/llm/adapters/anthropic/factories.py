from typing import Any, Union


class AnthropicClientWrapper:
    def __init__(self, client: Any, model: str):
        self.client = client
        self.model = model

    def __getattr__(self, name: str) -> Any:
        return getattr(self.client, name)


def create_anthropic_client(model: str, is_async: bool = False, **kwargs: Any) -> Any:
    try:
        from anthropic import Anthropic, AsyncAnthropic

        if is_async:
            client: Union[Anthropic, AsyncAnthropic] = AsyncAnthropic(max_retries=0, **kwargs)
        else:
            client = Anthropic(max_retries=0, **kwargs)

        return AnthropicClientWrapper(client, model)
    except ImportError:
        raise ImportError("Anthropic package not installed. Run: pip install anthropic")
