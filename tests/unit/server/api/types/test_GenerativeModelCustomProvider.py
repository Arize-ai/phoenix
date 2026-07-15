from types import SimpleNamespace
from typing import Any, cast

from phoenix.server.api.types.GenerativeModelCustomProvider import (
    GenerativeModelCustomProvider,
)


async def test_anthropic_custom_provider_lists_minimax_models() -> None:
    provider = GenerativeModelCustomProvider(
        id=1,
        db_record=cast(Any, SimpleNamespace(id=1, sdk="anthropic")),
    )

    model_names = await provider.model_names(cast(Any, None))

    assert "MiniMax-M3" in model_names
    assert "MiniMax-M2.7" in model_names
