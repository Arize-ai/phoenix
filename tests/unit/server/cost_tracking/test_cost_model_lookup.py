from datetime import datetime, timezone
from typing import Any, Mapping, Optional

import pytest

from phoenix.db import models
from phoenix.server.cost_tracking.cost_model_lookup import CostModelLookup


class TestCostModelLookup:
    """Test cases for CostModelLookup class."""

    @pytest.mark.parametrize(
        "generative_models,attributes,start_time,expected_model_id,test_description",
        [
            # Invalid attributes tests
            pytest.param(
                [
                    models.GenerativeModel(
                        id=1,
                        name="test-model",
                        provider="openai",
                        start_time=None,
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                ],
                {"llm": {"provider": "openai"}},  # No model name
                datetime.now(timezone.utc),
                None,
                "No model name should return None",
                id="no_model_name",
            ),
            pytest.param(
                [
                    models.GenerativeModel(
                        id=1,
                        name="test-model",
                        provider="openai",
                        start_time=None,
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                ],
                {"llm": {"model_name": "", "provider": "openai"}},  # Empty model name
                datetime.now(timezone.utc),
                None,
                "Empty model name should return None",
                id="empty_model_name",
            ),
            pytest.param(
                [
                    models.GenerativeModel(
                        id=1,
                        name="test-model",
                        provider="openai",
                        start_time=None,
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                ],
                {"llm": {"model_name": "   ", "provider": "openai"}},  # Whitespace model name
                datetime.now(timezone.utc),
                None,
                "Whitespace model name should return None",
                id="whitespace_model_name",
            ),
            pytest.param(
                [
                    models.GenerativeModel(
                        id=1,
                        name="test-model",
                        provider="openai",
                        start_time=None,
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                ],
                {},  # Empty attributes
                datetime.now(timezone.utc),
                None,
                "Empty attributes should return None",
                id="empty_attributes",
            ),
            # Provider filtering tests
            pytest.param(
                [
                    models.GenerativeModel(
                        id=1,
                        name="openai-model",
                        provider="openai",
                        start_time=None,
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    ),
                    models.GenerativeModel(
                        id=2,
                        name="anthropic-model",
                        provider="anthropic",
                        start_time=None,
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    ),
                ],
                {"llm": {"model_name": "gpt-3.5-turbo", "provider": "openai"}},
                datetime.now(timezone.utc),
                1,  # Expected model ID
                "OpenAI provider should match OpenAI model",
                id="openai_provider_match",
            ),
            pytest.param(
                [
                    models.GenerativeModel(
                        id=1,
                        name="openai-model",
                        provider="openai",
                        start_time=None,
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    ),
                    models.GenerativeModel(
                        id=2,
                        name="anthropic-model",
                        provider="anthropic",
                        start_time=None,
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    ),
                ],
                {"llm": {"model_name": "gpt-3.5-turbo", "provider": "anthropic"}},
                datetime.now(timezone.utc),
                2,  # Expected model ID
                "Anthropic provider should match Anthropic model",
                id="anthropic_provider_match",
            ),
            pytest.param(
                [
                    models.GenerativeModel(
                        id=1,
                        name="test-model",
                        provider="openai",
                        start_time=None,
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                ],
                {"llm": {"model_name": "gpt-3.5-turbo", "provider": "azure"}},
                datetime.now(timezone.utc),
                1,  # Provider-agnostic model should match when no provider-specific model available
                "Provider-agnostic model should match when no provider-specific model available",
                id="provider_agnostic_azure",
            ),
            pytest.param(
                [
                    models.GenerativeModel(
                        id=1,
                        name="test-model",
                        provider="openai",
                        start_time=None,
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                ],
                {"llm": {"model_name": "gpt-3.5-turbo", "provider": "azure"}},
                datetime.now(timezone.utc),
                1,  # Should fall back to available model when provider doesn't match
                "Provider mismatch should fall back to available model",
                id="provider_mismatch",
            ),
            # Empty provider in attributes tests
            pytest.param(
                [
                    models.GenerativeModel(
                        id=1,
                        name="test-model",
                        provider="openai",
                        start_time=None,
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                ],
                {"llm": {"model_name": "gpt-3.5-turbo", "provider": ""}},  # Empty provider
                datetime.now(timezone.utc),
                1,  # Should match when provider is empty
                "Model should match when provider is empty in attributes",
                id="empty_provider_in_attributes",
            ),
            pytest.param(
                [
                    models.GenerativeModel(
                        id=1,
                        name="test-model",
                        provider="openai",
                        start_time=None,
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                ],
                {"llm": {"model_name": "gpt-3.5-turbo"}},  # No provider
                datetime.now(timezone.utc),
                1,  # Should match when no provider specified
                "Model should match when no provider specified in attributes",
                id="no_provider_in_attributes",
            ),
            # Provider-agnostic with empty provider tests
            pytest.param(
                [
                    models.GenerativeModel(
                        id=1,
                        name="test-model",
                        provider=None,  # Provider-agnostic
                        start_time=None,
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                ],
                {"llm": {"model_name": "gpt-3.5-turbo", "provider": ""}},  # Empty provider
                datetime.now(timezone.utc),
                1,  # Provider-agnostic should match when provider is empty
                "Provider-agnostic model should match when provider is empty",
                id="provider_agnostic_empty_provider",
            ),
            pytest.param(
                [
                    models.GenerativeModel(
                        id=1,
                        name="test-model",
                        provider=None,  # Provider-agnostic
                        start_time=None,
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                ],
                {"llm": {"model_name": "gpt-3.5-turbo"}},  # No provider
                datetime.now(timezone.utc),
                1,  # Provider-agnostic should match when no provider specified
                "Provider-agnostic model should match when no provider specified",
                id="provider_agnostic_no_provider",
            ),
            # Time filtering tests
            pytest.param(
                [
                    models.GenerativeModel(
                        id=1,
                        name="past-model",
                        provider="openai",
                        start_time=datetime(2023, 1, 1, tzinfo=timezone.utc),  # Past start time
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    ),
                    models.GenerativeModel(
                        id=2,
                        name="future-model",
                        provider="openai",
                        start_time=datetime(2025, 1, 1, tzinfo=timezone.utc),  # Future start time
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    ),
                ],
                {"llm": {"model_name": "gpt-3.5-turbo", "provider": "openai"}},
                datetime(2024, 1, 1, tzinfo=timezone.utc),
                1,  # Expected model ID (past model)
                "Current time should match past start_time model",
                id="time_filtering_past_model",
            ),
            pytest.param(
                [
                    models.GenerativeModel(
                        id=1,
                        name="test-model",
                        provider="openai",
                        start_time=None,  # No start_time specified
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                ],
                {"llm": {"model_name": "gpt-3.5-turbo", "provider": "openai"}},
                datetime(2020, 1, 1, tzinfo=timezone.utc),
                1,  # Expected model ID
                "Model without start_time should match any time",
                id="no_start_time_past",
            ),
            pytest.param(
                [
                    models.GenerativeModel(
                        id=1,
                        name="test-model",
                        provider="openai",
                        start_time=None,  # No start_time specified
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                ],
                {"llm": {"model_name": "gpt-3.5-turbo", "provider": "openai"}},
                datetime(2024, 1, 1, tzinfo=timezone.utc),
                1,  # Expected model ID
                "Model without start_time should match any time",
                id="no_start_time_current",
            ),
            pytest.param(
                [
                    models.GenerativeModel(
                        id=1,
                        name="test-model",
                        provider="openai",
                        start_time=None,  # No start_time specified
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                ],
                {"llm": {"model_name": "gpt-3.5-turbo", "provider": "openai"}},
                datetime(2030, 1, 1, tzinfo=timezone.utc),
                1,  # Expected model ID
                "Model without start_time should match any time",
                id="no_start_time_future",
            ),
            # Regex matching tests
            pytest.param(
                [
                    models.GenerativeModel(
                        id=1,
                        name="gpt-3.5-model",
                        provider="openai",
                        start_time=None,
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    ),
                    models.GenerativeModel(
                        id=2,
                        name="gpt-4-model",
                        provider="openai",
                        start_time=None,
                        name_pattern="gpt-4",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    ),
                ],
                {"llm": {"model_name": "gpt-3.5-turbo", "provider": "openai"}},
                datetime.now(timezone.utc),
                1,  # Expected model ID
                "Exact regex pattern should match",
                id="regex_exact_match",
            ),
            pytest.param(
                [
                    models.GenerativeModel(
                        id=1,
                        name="gpt-3.5-model",
                        provider="openai",
                        start_time=None,
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    ),
                    models.GenerativeModel(
                        id=2,
                        name="gpt-4-model",
                        provider="openai",
                        start_time=None,
                        name_pattern="gpt-4",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    ),
                ],
                {"llm": {"model_name": "gpt-4", "provider": "openai"}},
                datetime.now(timezone.utc),
                2,  # Expected model ID
                "Different regex pattern should match different model",
                id="regex_different_match",
            ),
            pytest.param(
                [
                    models.GenerativeModel(
                        id=1,
                        name="test-model",
                        provider="openai",
                        start_time=None,
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                ],
                {"llm": {"model_name": "gpt-4", "provider": "openai"}},
                datetime.now(timezone.utc),
                None,
                "No regex match should return None",
                id="no_regex_match",
            ),
            # Priority tests
            pytest.param(
                [
                    models.GenerativeModel(
                        id=1,
                        name="non-override-model",
                        provider="openai",
                        start_time=None,
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    ),
                    models.GenerativeModel(
                        id=2,
                        name="override-model",
                        provider="openai",
                        start_time=None,
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=False,  # Override model
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    ),
                ],
                {"llm": {"model_name": "gpt-3.5-turbo", "provider": "openai"}},
                datetime.now(timezone.utc),
                2,  # Expected model ID (override should win)
                "Override model should take priority",
                id="priority_override_wins",
            ),
            pytest.param(
                [
                    models.GenerativeModel(
                        id=1,
                        name="specific-model",
                        provider="openai",
                        start_time=None,
                        name_pattern="gpt-3\\.5-turbo",  # More specific
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    ),
                    models.GenerativeModel(
                        id=2,
                        name="general-model",
                        provider="openai",
                        start_time=None,
                        name_pattern="gpt-3\\.5.*",  # Less specific
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    ),
                ],
                {"llm": {"model_name": "gpt-3.5-turbo", "provider": "openai"}},
                datetime.now(timezone.utc),
                1,  # Expected model ID (more specific should win)
                "More specific pattern should take priority",
                id="priority_specificity_wins",
            ),
            pytest.param(
                [
                    models.GenerativeModel(
                        id=1,
                        name="low-id-model",
                        provider="openai",
                        start_time=None,
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    ),
                    models.GenerativeModel(
                        id=2,
                        name="high-id-model",
                        provider="openai",
                        start_time=None,
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    ),
                ],
                {"llm": {"model_name": "gpt-3.5-turbo", "provider": "openai"}},
                datetime.now(timezone.utc),
                1,  # Expected model ID (lower ID should win)
                "Lower ID should win tie-breaker",
                id="priority_tie_breaker",
            ),
            # Complex priority scenario
            pytest.param(
                [
                    models.GenerativeModel(
                        id=1,
                        name="model1",
                        provider="openai",
                        start_time=None,
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    ),
                    models.GenerativeModel(
                        id=10,
                        name="model2",
                        provider="openai",
                        start_time=None,
                        name_pattern="gpt-3\\.5.*",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    ),
                    models.GenerativeModel(
                        id=20,
                        name="model3",
                        provider="openai",
                        start_time=None,
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=False,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    ),
                ],
                {"llm": {"model_name": "gpt-3.5-turbo", "provider": "openai"}},
                datetime.now(timezone.utc),
                20,  # Expected model ID (override > specificity > tie-breaker)
                "Complex priority: override > specificity > tie-breaker",
                id="complex_priority_scenario",
            ),
            # Wildcard pattern tests
            pytest.param(
                [
                    models.GenerativeModel(
                        id=1,
                        name="wildcard-model",
                        provider="openai",
                        start_time=None,
                        name_pattern="gpt-3\\.5.*",  # Wildcard pattern
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                ],
                {"llm": {"model_name": "gpt-3.5", "provider": "openai"}},
                datetime.now(timezone.utc),
                1,  # Expected model ID
                "Wildcard pattern should match gpt-3.5",
                id="wildcard_gpt_3_5",
            ),
            pytest.param(
                [
                    models.GenerativeModel(
                        id=1,
                        name="wildcard-model",
                        provider="openai",
                        start_time=None,
                        name_pattern="gpt-3\\.5.*",  # Wildcard pattern
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                ],
                {"llm": {"model_name": "gpt-3.5-turbo", "provider": "openai"}},
                datetime.now(timezone.utc),
                1,  # Expected model ID
                "Wildcard pattern should match gpt-3.5-turbo",
                id="wildcard_gpt_3_5_turbo",
            ),
            pytest.param(
                [
                    models.GenerativeModel(
                        id=1,
                        name="wildcard-model",
                        provider="openai",
                        start_time=None,
                        name_pattern="gpt-3\\.5.*",  # Wildcard pattern
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                ],
                {"llm": {"model_name": "gpt-3.5-turbo-16k", "provider": "openai"}},
                datetime.now(timezone.utc),
                1,  # Expected model ID
                "Wildcard pattern should match gpt-3.5-turbo-16k",
                id="wildcard_gpt_3_5_turbo_16k",
            ),
            # Anchored pattern tests
            pytest.param(
                [
                    models.GenerativeModel(
                        id=1,
                        name="anchored-model",
                        provider="openai",
                        start_time=None,
                        name_pattern="^gpt-3\\.5-turbo$",  # Anchored pattern
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                ],
                {"llm": {"model_name": "gpt-3.5-turbo", "provider": "openai"}},
                datetime.now(timezone.utc),
                1,  # Expected model ID
                "Anchored pattern should match exact string",
                id="anchored_exact_match",
            ),
            pytest.param(
                [
                    models.GenerativeModel(
                        id=1,
                        name="anchored-model",
                        provider="openai",
                        start_time=None,
                        name_pattern="^gpt-3\\.5-turbo$",  # Anchored pattern
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                ],
                {"llm": {"model_name": "prefix-gpt-3.5-turbo", "provider": "openai"}},
                datetime.now(timezone.utc),
                None,
                "Anchored pattern should not match with prefix",
                id="anchored_prefix_no_match",
            ),
            # Future start time filtering test
            pytest.param(
                [
                    models.GenerativeModel(
                        id=1,
                        name="future-model",
                        provider="openai",
                        start_time=datetime(2025, 1, 1, tzinfo=timezone.utc),  # Future start time
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                ],
                {"llm": {"model_name": "gpt-3.5-turbo", "provider": "openai"}},
                datetime(2024, 1, 1, tzinfo=timezone.utc),  # Current time before start_time
                None,  # Should return None when all models have future start times
                "Should return None when all models have future start times",
                id="future_start_time_filtering",
            ),
            # Provider agnostic tests
            pytest.param(
                [
                    models.GenerativeModel(
                        id=1,
                        name="test-model",
                        provider=None,  # No provider specified
                        start_time=None,
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                ],
                {"llm": {"model_name": "gpt-3.5-turbo", "provider": "openai"}},
                datetime.now(timezone.utc),
                1,  # Provider-agnostic model should match when no provider-specific model available
                "Provider-agnostic model should match when no provider-specific model available",
                id="provider_agnostic_openai",
            ),
            pytest.param(
                [
                    models.GenerativeModel(
                        id=1,
                        name="test-model",
                        provider=None,  # No provider specified
                        start_time=None,
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                ],
                {"llm": {"model_name": "gpt-3.5-turbo", "provider": "anthropic"}},
                datetime.now(timezone.utc),
                1,  # Provider-agnostic model should match when no provider-specific model available
                "Provider-agnostic model should match when no provider-specific model available",
                id="provider_agnostic_anthropic",
            ),
            # Provider-specific vs provider-agnostic priority test
            pytest.param(
                [
                    models.GenerativeModel(
                        id=1,
                        name="provider-agnostic-model",
                        provider=None,  # Provider-agnostic
                        start_time=None,
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    ),
                    models.GenerativeModel(
                        id=2,
                        name="openai-specific-model",
                        provider="openai",  # Provider-specific
                        start_time=None,
                        name_pattern="gpt-3\\.5-turbo",
                        is_built_in=True,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    ),
                ],
                {"llm": {"model_name": "gpt-3.5-turbo", "provider": "openai"}},
                datetime.now(timezone.utc),
                2,  # Provider-specific model should be preferred over provider-agnostic
                "Provider-specific model should be preferred over provider-agnostic",
                id="provider_specific_vs_agnostic_priority",
            ),
        ],
    )
    def test_cost_model_lookup(
        self,
        generative_models: list[models.GenerativeModel],
        attributes: Mapping[str, Any],
        start_time: datetime,
        expected_model_id: Optional[int],
        test_description: str,
    ) -> None:
        lookup = CostModelLookup(generative_models)

        ans = lookup.find_model(start_time=start_time, attributes=attributes)

        if expected_model_id is None:
            assert ans is None, f"Expected None but got {ans}"
        else:
            assert ans is not None, f"Expected model with ID {expected_model_id} but got None"
            assert (
                ans.id == expected_model_id
            ), f"Expected model ID {expected_model_id} but got {ans.id}"
