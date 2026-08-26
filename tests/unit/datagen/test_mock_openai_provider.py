from scripts.datagen.mock_openai_provider import ScriptedOpenAIProvider
from scripts.datagen.recording import fixtures_for


def test_scripted_provider_serves_fixture_responses() -> None:
    provider = ScriptedOpenAIProvider.for_fixture(fixtures_for("plain_chat")[0])
    response = provider.http_client().post(
        "https://datagen.test/v1/chat/completions",
        json={"model": "model-exact", "messages": [{"role": "user", "content": "hello"}]},
    )

    assert response.status_code == 200
    assert response.json()["choices"][0]["message"]["content"].startswith("Yes.")
    assert provider.response_index == 1
