from typing import Any


def create_google_genai_client(model: str, is_async: bool = False, **kwargs: Any) -> Any:
    try:
        from google import genai

        client = genai.Client(**kwargs)
        return client.aio if is_async else client
    except ImportError:
        raise ImportError("Google GenAI package not installed. Run: pip install google-genai")
