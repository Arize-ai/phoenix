import pytest

from phoenix.evals.decision.types import (
    BaseDecisionAdapter,
    ClassificationResponse,
    ClassificationResult,
    TokenUsage,
)


def test_plural_classifications_is_the_adapter_contract():
    """An adapter only needs to implement the plural generate_classifications."""

    class DummyAdapter(BaseDecisionAdapter):
        @classmethod
        def client_name(cls):
            return "dummy"

        def generate_classifications(self, prompt, criteria, **kwargs):
            return ClassificationResponse(
                results={
                    name: ClassificationResult(
                        label=criterion["labels"][0], metadata={"model_id": "dummy"}
                    )
                    for name, criterion in criteria.items()
                },
                usage=TokenUsage(input_tokens=20, output_tokens=4),
            )

        async def async_generate_classifications(self, prompt, criteria, **kwargs):
            return self.generate_classifications(prompt, criteria, **kwargs)

    adapter = DummyAdapter(client=object(), model="dummy")
    raw = adapter.generate_classifications(
        "p",
        {
            "q1": {"labels": ["a", "b"]},
            "q2": {"labels": ["c", "d"]},
        },
    )

    assert raw == ClassificationResponse(
        results={
            "q1": ClassificationResult(label="a", metadata={"model_id": "dummy"}),
            "q2": ClassificationResult(label="c", metadata={"model_id": "dummy"}),
        },
        usage=TokenUsage(input_tokens=20, output_tokens=4),
    )


def test_adapter_missing_plural_methods_cannot_be_instantiated():
    """generate_classifications/async are abstract, so an adapter that omits them is abstract."""

    class Incomplete(BaseDecisionAdapter):
        @classmethod
        def client_name(cls):
            return "dummy"

    with pytest.raises(TypeError, match="abstract"):
        Incomplete(client=object(), model="dummy")


def test_to_state_passes_a_string_prompt_through_unchanged():
    assert BaseDecisionAdapter._to_state("just some text") == "just some text"


def test_to_state_joins_a_message_list_and_drops_roles():
    prompt = [
        {"role": "system", "content": "You are a judge."},
        {"role": "user", "content": "Is 2 + 2 = 4?"},
    ]
    assert BaseDecisionAdapter._to_state(prompt) == "You are a judge.\n\nIs 2 + 2 = 4?"


def test_to_state_keeps_only_text_content_parts():
    prompt = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "first"},
                {"type": "image_url", "image_url": {"url": "http://example.com/x.png"}},
                {"type": "text", "text": "second"},
            ],
        },
    ]
    assert BaseDecisionAdapter._to_state(prompt) == "first\nsecond"


def test_to_state_skips_empty_pieces():
    prompt = [
        {"role": "system", "content": ""},
        {"role": "user", "content": "only this"},
    ]
    assert BaseDecisionAdapter._to_state(prompt) == "only this"
