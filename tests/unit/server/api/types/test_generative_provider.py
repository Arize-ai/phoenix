from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.types.GenerativeProvider import (
    GENERATIVE_PROVIDER_KEY_TO_PROVIDER_STRING,
    GenerativeProvider,
    GenerativeProviderKey,
)


def test_vertex_ai_round_trips_through_model_provider() -> None:
    assert (
        GenerativeProviderKey.from_model_provider(ModelProvider.VERTEX_AI)
        is GenerativeProviderKey.VERTEX_AI
    )
    assert (
        GenerativeProviderKey.VERTEX_AI.to_model_provider()
        is ModelProvider.VERTEX_AI
    )


def test_vertex_ai_has_distinct_oi_attribution() -> None:
    assert (
        GENERATIVE_PROVIDER_KEY_TO_PROVIDER_STRING[GenerativeProviderKey.VERTEX_AI]
        == "vertex_ai"
    )
    assert (
        GENERATIVE_PROVIDER_KEY_TO_PROVIDER_STRING[GenerativeProviderKey.GOOGLE]
        != "vertex_ai"
    )


def test_vertex_ai_prefix_map_includes_gemini_and_claude() -> None:
    prefixes = GenerativeProvider.model_provider_to_model_prefix_map[
        GenerativeProviderKey.VERTEX_AI
    ]
    assert "gemini" in prefixes
    assert "claude" in prefixes


def test_vertex_ai_credentials_require_project_only() -> None:
    creds = GenerativeProvider.model_provider_to_credential_requirements_map[
        GenerativeProviderKey.VERTEX_AI
    ]
    by_name = {c.env_var_name: c for c in creds}
    assert by_name["GOOGLE_CLOUD_PROJECT"].is_required is True
    assert by_name["GOOGLE_CLOUD_LOCATION"].is_required is False
    assert "GOOGLE_APPLICATION_CREDENTIALS_JSON" not in by_name
