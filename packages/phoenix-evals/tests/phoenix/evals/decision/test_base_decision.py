from phoenix.evals.decision.types import BaseDecisionAdapter


def test_base_adapter_fans_out_to_single_calls_by_default():
    """An adapter that does not override generate_classifications falls back to N single calls."""

    class DummyAdapter(BaseDecisionAdapter):
        @classmethod
        def client_name(cls):
            return "dummy"

        def generate_classification(self, prompt, labels, **kwargs):
            label = next(iter(labels)) if isinstance(labels, dict) else labels[0]
            return {"label": label, "metadata": {"model_id": "dummy"}}

        async def async_generate_classification(self, prompt, labels, **kwargs):
            return self.generate_classification(prompt, labels, **kwargs)

    adapter = DummyAdapter(client=object(), model="dummy")
    raw = adapter.generate_classifications(
        "p",
        [{"name": "q1", "labels": ["a", "b"]}, {"name": "q2", "labels": ["c", "d"]}],
    )

    assert raw == {
        "results": [
            {"name": "q1", "label": "a", "metadata": {"model_id": "dummy"}},
            {"name": "q2", "label": "c", "metadata": {"model_id": "dummy"}},
        ],
        "usage": None,
    }


def test_base_adapter_fanout_sums_usage_across_calls():
    """The fan-out default sums each single call's token usage onto the aggregate result."""

    class DummyAdapter(BaseDecisionAdapter):
        @classmethod
        def client_name(cls):
            return "dummy"

        def generate_classification(self, prompt, labels, **kwargs):
            return {
                "label": labels[0],
                "metadata": {"model_id": "dummy"},
                "usage": {"input_tokens": 10, "output_tokens": 2},
            }

        async def async_generate_classification(self, prompt, labels, **kwargs):
            return self.generate_classification(prompt, labels, **kwargs)

    adapter = DummyAdapter(client=object(), model="dummy")
    raw = adapter.generate_classifications(
        "p",
        [{"name": "q1", "labels": ["a", "b"]}, {"name": "q2", "labels": ["c", "d"]}],
    )

    # Two calls at 10/2 tokens each -> summed.
    assert raw["usage"] == {"input_tokens": 20, "output_tokens": 4}
    # Per-call usage is not leaked into each result.
    assert all("usage" not in r for r in raw["results"])


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
