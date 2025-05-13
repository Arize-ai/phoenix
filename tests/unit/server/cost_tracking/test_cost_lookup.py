import pytest

from phoenix.server.cost_tracking.cost_lookup import ModelCostLookup, ModelSpec


@pytest.fixture()
def cost_lookup():
    return ModelCostLookup()


def test_set_and_get_item(cost_lookup):
    spec = ModelSpec(provider="openai", model="gpt-3.5-turbo")
    cost_lookup[spec] = 0.02

    assert cost_lookup[spec] == 0.02, "Value should be retrievable with the exact spec key"


def test_contains_and_len(cost_lookup):
    spec1 = ModelSpec("openai", "gpt-4")
    spec2 = ModelSpec("anthropic", "claude-3")

    assert len(cost_lookup) == 0
    assert spec1 not in cost_lookup

    cost_lookup[spec1] = 0.05
    cost_lookup[spec2] = 0.012

    assert spec1 in cost_lookup
    assert spec2 in cost_lookup
    assert len(cost_lookup) == 2


def test_provider_agnostic_lookup(cost_lookup):
    cost_lookup[ModelSpec("openai", "gpt-3.5")] = 0.02
    cost_lookup[ModelSpec("azure", "gpt-3.5")] = 0.018

    result = cost_lookup[ModelSpec(None, "gpt-3.5")]
    assert isinstance(result, list)
    assert sorted(result) == [("openai", 0.018), ("azure", 0.02)]

    assert ModelSpec(None, "gpt-3.5") in cost_lookup
    assert ModelSpec(None, "gpt-3.5-turbo") not in cost_lookup


def test_deletion(cost_lookup):
    spec = ModelSpec("openai", "gpt-3.5-turbo")
    cost_lookup[spec] = 0.02

    del cost_lookup[spec]

    assert spec not in cost_lookup
    with pytest.raises(KeyError):
        _ = cost_lookup[spec]


def test_keyerror_on_missing(cost_lookup):
    with pytest.raises(KeyError):
        _ = cost_lookup[ModelSpec("nonexistent", "gpt-0")]
