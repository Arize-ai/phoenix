from typing import Any


class GoogleGenAIClientWrapper:
    def __init__(self, client: Any, model: str):
        self.client = client
        self.model = model

    def __getattr__(self, name: str) -> Any:
        return getattr(self.client, name)


def create_google_genai_client(model: str, is_async: bool = False, **kwargs: Any) -> Any:
    try:
        from google import genai

        client = genai.Client(**kwargs)
        actual_client = client.aio if is_async else client
        return GoogleGenAIClientWrapper(actual_client, model)
    except ImportError:
        raise ImportError("Google GenAI package not installed. Run: pip install google-genai")
