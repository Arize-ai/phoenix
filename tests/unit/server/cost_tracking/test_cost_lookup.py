import re

import pytest

from phoenix.server.cost_tracking.cost_lookup import (
    CostOverride,
    ModelCostLookup,
    ModelName,
    ModelPattern,
)


@pytest.fixture()
def cost_lookup():
    return ModelCostLookup()


def test_set_and_get_item(cost_lookup):
    insert_spec = ModelPattern(provider="openai", pattern=re.compile(r"gpt-3\.5-turbo"))
    cost_lookup.add_pattern(insert_spec, 0.02)

    retrieve_spec = ModelName(provider="openai", name="gpt-3.5-turbo")

    assert cost_lookup.get_cost(retrieve_spec) == 0.02


def test_contains_and_len(cost_lookup):
    model1 = ModelName("openai", "gpt-4")
    model2 = ModelName("anthropic", "claude-3")

    assert cost_lookup.pattern_count() == 0
    assert not cost_lookup.has_model(model1)

    pattern1 = ModelPattern("openai", re.compile(r"gpt-4"))
    pattern2 = ModelPattern("anthropic", re.compile(r"claude-3"))

    cost_lookup.add_pattern(pattern1, 0.05)
    cost_lookup.add_pattern(pattern2, 0.012)

    assert cost_lookup.has_model(model1)
    assert cost_lookup.has_model(model2)
    assert cost_lookup.pattern_count() == 2


def test_provider_agnostic_lookup(cost_lookup):
    cost_lookup.add_pattern(ModelPattern("openai", re.compile(r"gpt-3\.5")), 0.02)
    cost_lookup.add_pattern(ModelPattern("azure", re.compile(r"gpt-3\.5")), 0.018)

    result = cost_lookup.get_cost(ModelName(None, "gpt-3.5"))
    assert isinstance(result, list)
    assert ("azure", 0.018) in result
    assert ("openai", 0.02) in result

    assert cost_lookup.has_model(ModelName(None, "gpt-3.5"))
    assert not cost_lookup.has_model(ModelName(None, "gpt-3.5-turbo"))


def test_deletion(cost_lookup):
    insert_spec = ModelPattern("openai", re.compile(r"gpt-3\.5-turbo"))
    cost_lookup.add_pattern(insert_spec, 0.02)

    cost_lookup.remove_pattern(insert_spec)

    retrieve_spec = ModelName("openai", "gpt-3.5-turbo")

    assert not cost_lookup.has_model(retrieve_spec)
    with pytest.raises(KeyError):
        _ = cost_lookup.get_cost(retrieve_spec)


def test_keyerror_on_missing(cost_lookup):
    with pytest.raises(KeyError):
        _ = cost_lookup.get_cost(ModelName("nonexistent", "gpt-0"))


def test_regex_match_single_provider(cost_lookup):
    pattern = ModelPattern("openai", re.compile(r"gpt-3\.5.*"))
    cost_lookup.add_pattern(pattern, 0.02)

    assert cost_lookup.get_cost(ModelName("openai", "gpt-3.5")) == 0.02
    assert cost_lookup.get_cost(ModelName("openai", "gpt-3.5-turbo")) == 0.02


def test_regex_match_multiple_providers(cost_lookup):
    """Provider-agnostic look-ups should return all providers whose regex matches."""
    cost_lookup.add_pattern(ModelPattern("anthropic", re.compile(r"model.*")), 0.012)
    cost_lookup.add_pattern(ModelPattern("openai", re.compile(r"model.*")), 0.02)

    results = cost_lookup.get_cost(ModelName(None, "model-3"))
    result_dict = dict(results)
    assert result_dict["anthropic"] == 0.012
    assert result_dict["openai"] == 0.02


def test_regex_no_match_raises(cost_lookup):
    cost_lookup.add_pattern(ModelPattern("openai", re.compile(r"gpt-3\.5.*")), 0.02)

    with pytest.raises(KeyError):
        _ = cost_lookup.get_cost(ModelName("openai", "gpt-4"))


def test_override_precedence(cost_lookup):
    """An override should take precedence over the base cost table."""
    base_pattern = ModelPattern("openai", re.compile(r"gpt-4"))
    cost_lookup.add_pattern(base_pattern, 0.06)

    override = CostOverride("openai", re.compile(r"gpt-4"), 0.04)
    cost_lookup.add_override(override)

    assert cost_lookup.get_cost(ModelName("openai", "gpt-4")) == 0.04


def test_override_provider_agnostic_lookup(cost_lookup):
    """Provider-agnostic lookups should reflect overrides per provider."""
    cost_lookup.add_pattern(ModelPattern("openai", re.compile(r"gpt-3\.5")), 0.02)
    cost_lookup.add_pattern(ModelPattern("azure", re.compile(r"gpt-3\.5")), 0.018)

    cost_lookup.add_override(CostOverride("openai", re.compile(r"gpt-3\.5"), 0.015))

    results = cost_lookup.get_cost(ModelName(None, "gpt-3.5"))
    result_dict = dict(results)
    assert result_dict["openai"] == 0.015
    assert result_dict["azure"] == 0.018


def test_multiple_overrides_priority(cost_lookup):
    """Later overrides should have higher priority (LIFO)."""
    cost_lookup.add_override(CostOverride("anthropic", re.compile(r"claude-3"), 0.03))
    # Higher-priority override added later.
    cost_lookup.add_override(CostOverride("anthropic", re.compile(r"claude-3"), 0.025))

    cost_lookup.add_pattern(ModelPattern("anthropic", re.compile(r"claude-3")), 0.05)

    assert cost_lookup.get_cost(ModelName("anthropic", "claude-3")) == 0.025
