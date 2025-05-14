import re

import pytest

from phoenix.server.cost_tracking.cost_lookup import (
    ModelCostLookup,
    ModelName,
    ModelPattern,
)


@pytest.fixture()
def cost_lookup():
    return ModelCostLookup()


def test_set_and_get_item(cost_lookup):
    insert_spec = ModelPattern(provider="openai", pattern=re.compile(r"gpt-3\.5-turbo"))
    cost_lookup[insert_spec] = 0.02

    retrieve_spec = ModelName(provider="openai", name="gpt-3.5-turbo")

    assert cost_lookup[retrieve_spec] == 0.02, "Value should be retrievable with the exact spec key"


def test_contains_and_len(cost_lookup):
    model1 = ModelName("openai", "gpt-4")
    model2 = ModelName("anthropic", "claude-3")

    assert len(cost_lookup) == 0
    assert model1 not in cost_lookup

    pattern1 = ModelPattern("openai", re.compile(r"gpt-4"))
    pattern2 = ModelPattern("anthropic", re.compile(r"claude-3"))

    cost_lookup[pattern1] = 0.05
    cost_lookup[pattern2] = 0.012

    assert model1 in cost_lookup
    assert model2 in cost_lookup
    assert len(cost_lookup) == 2


def test_provider_agnostic_lookup(cost_lookup):
    cost_lookup[ModelPattern("openai", re.compile(r"gpt-3\.5"))] = 0.02
    cost_lookup[ModelPattern("azure", re.compile(r"gpt-3\.5"))] = 0.018

    result = cost_lookup[ModelName(None, "gpt-3.5")]
    assert isinstance(result, list)
    assert ("azure", 0.018) in result
    assert ("openai", 0.02) in result

    assert ModelName(None, "gpt-3.5") in cost_lookup
    assert ModelName(None, "gpt-3.5-turbo") not in cost_lookup


def test_deletion(cost_lookup):
    insert_spec = ModelPattern("openai", re.compile(r"gpt-3\.5-turbo"))
    cost_lookup[insert_spec] = 0.02

    del cost_lookup[insert_spec]

    retrieve_spec = ModelName("openai", "gpt-3.5-turbo")

    assert retrieve_spec not in cost_lookup
    with pytest.raises(KeyError):
        _ = cost_lookup[retrieve_spec]


def test_keyerror_on_missing(cost_lookup):
    with pytest.raises(KeyError):
        _ = cost_lookup[ModelName("nonexistent", "gpt-0")]


def test_regex_match_single_provider(cost_lookup):
    pattern = ModelPattern("openai", re.compile(r"gpt-3\.5.*"))
    cost_lookup[pattern] = 0.02

    assert cost_lookup[ModelName("openai", "gpt-3.5")] == 0.02
    assert cost_lookup[ModelName("openai", "gpt-3.5-turbo")] == 0.02


def test_regex_match_multiple_providers(cost_lookup):
    """Provider-agnostic look-ups should return all providers whose regex matches."""
    cost_lookup[ModelPattern("anthropic", re.compile(r"model.*"))] = 0.012
    cost_lookup[ModelPattern("openai", re.compile(r"model.*"))] = 0.02

    results = cost_lookup[ModelName(None, "model-3")]
    result_dict = dict(results)
    assert result_dict["anthropic"] == 0.012
    assert result_dict["openai"] == 0.02


def test_regex_no_match_raises(cost_lookup):
    cost_lookup[ModelPattern("openai", re.compile(r"gpt-3\.5.*"))] = 0.02

    with pytest.raises(KeyError):
        _ = cost_lookup[ModelName("openai", "gpt-4")]
