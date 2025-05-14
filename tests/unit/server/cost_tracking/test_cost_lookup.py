import re
import unittest.mock as mock

import pytest

from phoenix.server.cost_tracking.cost_lookup import (
    ModelCostLookup,
)


@pytest.fixture()
def cost_lookup() -> ModelCostLookup:
    return ModelCostLookup()


def test_set_and_get_item(cost_lookup: ModelCostLookup) -> None:
    regex = re.compile(r"gpt-3\.5-turbo")
    cost_lookup.add_pattern("openai", regex, 0.02)

    assert cost_lookup.get_cost(provider="openai", model="gpt-3.5-turbo") == 0.02


def test_contains_and_len(cost_lookup: ModelCostLookup) -> None:
    provider1, name1 = "openai", "gpt-4"
    provider2, name2 = "anthropic", "claude-3"

    assert cost_lookup.pattern_count() == 0
    assert not cost_lookup.has_model(provider=provider1, model=name1)

    cost_lookup.add_pattern("openai", re.compile(r"gpt-4"), 0.05)
    cost_lookup.add_pattern("anthropic", re.compile(r"claude-3"), 0.012)

    assert cost_lookup.has_model(provider=provider1, model=name1)
    assert cost_lookup.has_model(provider=provider2, model=name2)
    assert cost_lookup.pattern_count() == 2


def test_provider_agnostic_lookup(cost_lookup: ModelCostLookup) -> None:
    cost_lookup.add_pattern("openai", re.compile(r"gpt-3\.5"), 0.02)
    cost_lookup.add_pattern("azure", re.compile(r"gpt-3\.5"), 0.018)

    result = cost_lookup.get_cost(None, "gpt-3.5")
    assert isinstance(result, list)
    assert ("azure", 0.018) in result
    assert ("openai", 0.02) in result

    assert cost_lookup.has_model(None, "gpt-3.5")
    assert not cost_lookup.has_model(None, "gpt-3.5-turbo")


def test_deletion(cost_lookup: ModelCostLookup) -> None:
    cost_lookup.add_pattern(provider="openai", regex=re.compile(r"gpt-3\.5-turbo"), cost=0.02)

    cost_lookup.remove_pattern(provider="openai", regex=re.compile(r"gpt-3\.5-turbo"))

    assert not cost_lookup.has_model(provider="openai", model="gpt-3.5-turbo")
    with pytest.raises(KeyError):
        _ = cost_lookup.get_cost(provider="openai", model="gpt-3.5-turbo")


def test_keyerror_on_missing(cost_lookup: ModelCostLookup) -> None:
    with pytest.raises(KeyError):
        _ = cost_lookup.get_cost(provider="nonexistent", model="gpt-0")


def test_regex_match_single_provider(cost_lookup: ModelCostLookup) -> None:
    cost_lookup.add_pattern(provider="openai", regex=re.compile(r"gpt-3\.5.*"), cost=0.02)

    assert cost_lookup.get_cost(provider="openai", model="gpt-3.5") == 0.02
    assert cost_lookup.get_cost(provider="openai", model="gpt-3.5-turbo") == 0.02


def test_regex_match_multiple_providers(cost_lookup: ModelCostLookup) -> None:
    """Provider-agnostic look-ups should return all providers whose regex matches."""
    cost_lookup.add_pattern(provider="anthropic", regex=re.compile(r"model.*"), cost=0.012)
    cost_lookup.add_pattern(provider="openai", regex=re.compile(r"model.*"), cost=0.02)

    results = cost_lookup.get_cost(None, "model-3")
    result_dict = dict(results)
    assert result_dict["anthropic"] == 0.012
    assert result_dict["openai"] == 0.02


def test_regex_no_match_raises(cost_lookup: ModelCostLookup) -> None:
    cost_lookup.add_pattern(provider="openai", regex=re.compile(r"gpt-3\.5.*"), cost=0.02)

    with pytest.raises(KeyError):
        _ = cost_lookup.get_cost(provider="openai", model="gpt-4")


def test_override_precedence(cost_lookup: ModelCostLookup) -> None:
    """An override should take precedence over the base cost table."""
    cost_lookup.add_pattern(provider="openai", regex=re.compile(r"gpt-4"), cost=0.06)

    cost_lookup.add_override(provider="openai", regex=re.compile(r"gpt-4"), cost=0.04)

    assert cost_lookup.get_cost(provider="openai", model="gpt-4") == 0.04


def test_override_provider_agnostic_lookup(cost_lookup: ModelCostLookup) -> None:
    """Provider-agnostic lookups should reflect overrides per provider."""
    cost_lookup.add_pattern(provider="openai", regex=re.compile(r"gpt-3\.5"), cost=0.02)
    cost_lookup.add_pattern(provider="azure", regex=re.compile(r"gpt-3\.5"), cost=0.018)

    cost_lookup.add_override(provider="openai", regex=re.compile(r"gpt-3\.5"), cost=0.015)

    results = cost_lookup.get_cost(None, "gpt-3.5")
    result_dict = dict(results)
    assert result_dict["openai"] == 0.015
    assert result_dict["azure"] == 0.018


def test_multiple_overrides_priority(cost_lookup: ModelCostLookup) -> None:
    """Later overrides should have higher priority (LIFO)."""
    cost_lookup.add_override(provider="anthropic", regex=re.compile(r"claude-3"), cost=0.03)
    # Higher-priority override added later.
    cost_lookup.add_override(provider="anthropic", regex=re.compile(r"claude-3"), cost=0.025)

    cost_lookup.add_pattern(provider="anthropic", regex=re.compile(r"claude-3"), cost=0.05)

    assert cost_lookup.get_cost(provider="anthropic", model="claude-3") == 0.025


def test_cache_population(cost_lookup: ModelCostLookup) -> None:
    cost_lookup.add_pattern(provider="openai", regex=re.compile(r"gpt-4"), cost=0.05)

    assert len(cost_lookup._cache) == 0

    assert cost_lookup.get_cost(provider="openai", model="gpt-4") == 0.05
    assert len(cost_lookup._cache) == 1


def test_cache_busted_on_override(cost_lookup: ModelCostLookup) -> None:
    pattern = re.compile(r"gpt-3\.5")
    cost_lookup.add_pattern(provider="openai", regex=pattern, cost=0.02)

    assert cost_lookup.get_cost(provider="openai", model="gpt-3.5") == 0.02
    assert cost_lookup._cache

    cost_lookup.add_override(provider="openai", regex=pattern, cost=0.015)

    assert len(cost_lookup._cache) == 0

    assert cost_lookup.get_cost(provider="openai", model="gpt-3.5") == 0.015
    assert cost_lookup._cache


def test_cache_hit_avoids_recompute(cost_lookup: ModelCostLookup) -> None:
    cost_lookup.add_pattern(provider="openai", regex=re.compile(r"gpt-4"), cost=0.05)

    with mock.patch.object(
        ModelCostLookup, "_lookup_cost", wraps=ModelCostLookup._lookup_cost, autospec=True
    ) as spy:
        assert cost_lookup.get_cost(provider="openai", model="gpt-4") == 0.05
        assert cost_lookup.get_cost(provider="openai", model="gpt-4") == 0.05

        assert spy.call_count == 1
