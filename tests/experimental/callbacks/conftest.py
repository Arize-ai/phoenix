from typing import Any, List, Optional

import pytest
from llama_index.embeddings.base import BaseEmbedding
from llama_index.indices.service_context import ServiceContext
from llama_index.llm_predictor.base import LLMPredictor
from llama_index.llms.mock import LLMMetadata, MockLLM
from llama_index.prompts.base import Prompt


def patch_token_splitter_newline(
    self: Any, text: str, metadata_str: Optional[str] = None
) -> List[str]:
    """Mock token splitter by newline."""
    if text == "":
        return []
    return text.split("\n")


def patch_llmpredictor_predict(self: Any, prompt: Prompt, **prompt_args: Any):
    """
    Simple patches of the LLM predictor.
    If a more robust patch is needed, see LlamaIndex's mock_predict.py
    """
    return "LLM predict"


def patch_llmpredictor_apredict(self: Any, prompt: Prompt, **prompt_args: Any):
    """
    Simple patches of the LLM predictor. If a more robust patch is needed, see
    LlamaIndex's mock_predict.py
    """
    return "LLM apredict"


@pytest.fixture
def patch_llm_predictor(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        LLMPredictor,
        "predict",
        patch_llmpredictor_predict,
    )
    monkeypatch.setattr(
        LLMPredictor,
        "apredict",
        patch_llmpredictor_apredict,
    )
    monkeypatch.setattr(
        LLMPredictor,
        "llm",
        MockLLM(),
    )
    monkeypatch.setattr(
        LLMPredictor,
        "__init__",
        lambda x: None,
    )
    monkeypatch.setattr(
        LLMPredictor,
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


@pytest.fixture()
def mock_service_context(
    patch_llm_predictor: Any,
) -> ServiceContext:
    return ServiceContext.from_defaults(
        embed_model=MockEmbedding(),
    )
