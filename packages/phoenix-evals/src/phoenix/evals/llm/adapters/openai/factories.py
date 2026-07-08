from typing import Any, Union


class OpenAIClientWrapper:
    def __init__(self, client: Any, model: str):
        self.client = client
        self.model = model

    def __getattr__(self, name: str) -> Any:
        return getattr(self.client, name)


def create_openai_client(model: str, is_async: bool, **kwargs: Any) -> Any:
    try:
        from openai import AsyncOpenAI, OpenAI

        if is_async:
            client: Union[AsyncOpenAI, OpenAI] = AsyncOpenAI(max_retries=0, **kwargs)
        else:
            client = OpenAI(max_retries=0, **kwargs)

        return OpenAIClientWrapper(client, model)
    except ImportError:
        raise ImportError("OpenAI package not installed. Run: pip install openai")


def create_azure_openai_client(model: str, is_async: bool, **kwargs: Any) -> Any:
    try:
        from openai import AsyncAzureOpenAI, AzureOpenAI

        if is_async:
            client: Union[AsyncAzureOpenAI, AzureOpenAI] = AsyncAzureOpenAI(max_retries=0, **kwargs)
        else:
            client = AzureOpenAI(max_retries=0, **kwargs)
        return OpenAIClientWrapper(client, model)
    except ImportError:
        raise ImportError("OpenAI package not installed. Run: pip install openai")
