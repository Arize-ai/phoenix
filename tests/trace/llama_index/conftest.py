from typing import Any, List, Optional

import pytest
from llama_index.embeddings.base import BaseEmbedding
from llama_index.indices.service_context import ServiceContext
from llama_index.llms import LLM
from llama_index.llms.mock import LLMMetadata, MockLLM


def patch_token_splitter_newline(text: str, metadata_str: Optional[str] = None) -> List[str]:
    """Mock token splitter by newline."""
    if text == "":
        return []
    return text.split("\n")


def patch_llm_predict(*prompt_args: Any, **prompt_kwargs: Any):
    """
    Simple patches of the LLM predictor.
    If a more robust patch is needed, see LlamaIndex's mock_predict.py
    """
    return "LLM predict"


def patch_llm_apredict(*prompt_args: Any, **prompt_kwargs: Any):
    """
    Simple patches of the LLM predictor. If a more robust patch is needed, see
    LlamaIndex's mock_predict.py
    """
    return "LLM apredict"


@pytest.fixture
def patch_llama_index_llm(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        LLM,
        "predict",
        patch_llm_predict,
    )
    monkeypatch.setattr(
        LLM,
        "apredict",
        patch_llm_apredict,
    )
    monkeypatch.setattr(
        LLM,
        "llm",
        MockLLM(),
    )
    monkeypatch.setattr(
        LLM,
        "__init__",
        lambda *args, **kwargs: None,
    )
    monkeypatch.setattr(
        LLM,
        "metadata",
        LLMMetadata(),
    )


class MockEmbedding(BaseEmbedding):
    async def _aget_query_embedding(self, query: str) -> List[float]:
        if query == "Query?":
            return [0, 0, 1, 0, 0]

        else:
            raise ValueError("Invalid query for `_get_query_embedding`.")

    async def _aget_text_embedding(self, text: str) -> List[float]:
        # assume dimensions are 5
        if text == "Text":
            return [1, 0, 0, 0, 0]
        else:
            raise ValueError("Invalid text for `mock_get_text_embedding`.")

    def _get_query_embedding(self, query: str) -> List[float]:
        """Mock get query embedding."""
        if query == "Query?":
            return [0, 0, 1, 0, 0]
            raise ValueError("Invalid query for `_get_query_embedding`.")

    def _get_text_embedding(self, text: str) -> List[float]:
        """Mock get text embedding."""
        # assume dimensions are 5
        if text == "Text":
            return [1, 0, 0, 0, 0]
        else:
            raise ValueError("Invalid text for `mock_get_text_embedding`.")

    @classmethod
    def class_name(cls) -> str:
        return "MockEmbedding"


@pytest.fixture()
def mock_service_context(
    patch_llama_index_llm: Any,
) -> ServiceContext:
    return ServiceContext.from_defaults(
        embed_model=MockEmbedding(),
    )


@pytest.fixture()
def mock_embed_model() -> BaseEmbedding:
    return MockEmbedding()
