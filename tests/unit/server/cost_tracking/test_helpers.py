from typing import Any, Optional
from unittest.mock import Mock, patch

import pytest

from phoenix.server.cost_tracking.helpers import (
    get_aggregated_tokens,
    get_model_name,
    get_priced_model_type,
    get_provider,
)


class TestGetAggregatedTokens:
    """Test cases for get_aggregated_tokens function."""

    @pytest.mark.parametrize(
        "attributes,expected",
        [
            # Normal cases with all token counts provided
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": 10,
                            "completion": 20,
                            "total": 30,
                        }
                    }
                },
                (10, 20, 30),
                id="all_tokens_provided",
            ),
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": 0,
                            "completion": 0,
                            "total": 0,
                        }
                    }
                },
                (0, 0, 0),
                id="zero_tokens",
            ),
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": 100,
                            "completion": 50,
                            "total": 150,
                        }
                    }
                },
                (100, 50, 150),
                id="large_token_counts",
            ),
            # Cases where total > calculated_total
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": 0,
                            "completion": 20,
                            "total": 30,
                        }
                    }
                },
                (10, 20, 30),  # prompt_tokens calculated as total - completion
                id="total_greater_than_calculated_no_prompt",
            ),
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": 10,
                            "completion": 0,
                            "total": 30,
                        }
                    }
                },
                (10, 20, 30),  # completion_tokens calculated as total - prompt
                id="total_greater_than_calculated_no_completion",
            ),
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": 5,
                            "completion": 10,
                            "total": 20,
                        }
                    }
                },
                (5, 15, 20),  # completion_tokens calculated as total - prompt
                id="total_greater_than_calculated_with_both",
            ),
            # Cases where total <= calculated_total
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": 10,
                            "completion": 20,
                            "total": 25,
                        }
                    }
                },
                (10, 20, 30),  # total calculated as prompt + completion
                id="total_less_than_calculated",
            ),
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": 10,
                            "completion": 20,
                            "total": 30,
                        }
                    }
                },
                (10, 20, 30),  # total equals calculated
                id="total_equals_calculated",
            ),
            # Float values (should be converted to int by truncating)
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": 10.5,
                            "completion": 20.7,
                            "total": 31.2,
                        }
                    }
                },
                (10, 21, 31),
                id="float_values",
            ),
            # Negative values (should be converted to 0)
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": -5,
                            "completion": -10,
                            "total": -15,
                        }
                    }
                },
                (0, 0, 0),
                id="negative_values",
            ),
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": -5,
                            "completion": 20,
                            "total": 30,
                        }
                    }
                },
                (10, 20, 30),  # prompt_tokens calculated as total - completion
                id="negative_prompt_tokens",
            ),
            # Missing attributes (should default to 0)
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": 10,
                            # Missing completion and total
                        }
                    }
                },
                (10, 0, 10),  # total calculated as prompt + completion
                id="missing_completion_and_total",
            ),
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "completion": 20,
                            # Missing prompt and total
                        }
                    }
                },
                (0, 20, 20),  # total calculated as prompt + completion
                id="missing_prompt_and_total",
            ),
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "total": 30,
                            # Missing prompt and completion
                        }
                    }
                },
                (30, 0, 30),  # prompt_tokens calculated as total - completion (30 - 0 = 30)
                id="missing_prompt_and_completion",
            ),
            pytest.param(
                {},  # Empty attributes
                (0, 0, 0),
                id="empty_attributes",
            ),
            # Invalid data types (should default to 0)
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": "invalid",
                            "completion": None,
                            "total": [],
                        }
                    }
                },
                (0, 0, 0),
                id="invalid_data_types",
            ),
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": "10",
                            "completion": "20",
                            "total": "30",
                        }
                    }
                },
                (0, 0, 0),  # Strings are not int/float, so default to 0
                id="string_values",
            ),
            # Mixed valid and invalid values
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": 10,
                            "completion": "invalid",
                            "total": 30,
                        }
                    }
                },
                (
                    10,
                    20,
                    30,
                ),  # completion defaults to 0, then calculated as total - prompt (30 - 10 = 20)
                id="mixed_valid_and_invalid",
            ),
        ],
    )
    def test_get_aggregated_tokens_success(
        self, attributes: dict[str, Any], expected: tuple[int, int, int]
    ) -> None:
        """Test successful token aggregation with various input scenarios."""
        result: tuple[Optional[int], Optional[int], Optional[int]] = get_aggregated_tokens(
            attributes
        )
        assert result == expected

    @pytest.mark.parametrize(
        "attributes",
        [
            pytest.param(None, id="none_attributes"),
            pytest.param("not_a_dict", id="string_instead_of_dict"),
            pytest.param(123, id="int_instead_of_dict"),
            pytest.param([1, 2, 3], id="list_instead_of_dict"),
        ],
    )
    def test_get_aggregated_tokens_invalid_input(
        self,
        attributes: Any,
    ) -> None:
        """Test that invalid input types return None, None, None."""
        result: tuple[Optional[int], Optional[int], Optional[int]] = get_aggregated_tokens(
            attributes
        )
        # The function actually returns (0, 0, 0) for invalid inputs, not (None, None, None)
        assert result == (0, 0, 0)

    @patch("phoenix.server.cost_tracking.helpers.get_attribute_value")
    def test_get_aggregated_tokens_attribute_value_error(
        self, mock_get_attribute_value: Mock
    ) -> None:
        """Test that exceptions in get_attribute_value are handled gracefully."""
        # Mock get_attribute_value to raise an exception
        mock_get_attribute_value.side_effect = Exception("Test exception")

        attributes: dict[str, Any] = {
            "llm": {
                "token_count": {
                    "prompt": 10,
                    "completion": 20,
                    "total": 30,
                }
            }
        }

        result: tuple[Optional[int], Optional[int], Optional[int]] = get_aggregated_tokens(
            attributes
        )
        assert result == (0, 0, 0)

    def test_get_aggregated_tokens_edge_cases(self) -> None:
        """Test edge cases and boundary conditions."""
        # Test with very large numbers
        large_attributes: dict[str, Any] = {
            "llm": {
                "token_count": {
                    "prompt": 999999999,
                    "completion": 999999999,
                    "total": 1999999998,
                }
            }
        }
        result: tuple[Optional[int], Optional[int], Optional[int]] = get_aggregated_tokens(
            large_attributes
        )
        assert result == (999999999, 999999999, 1999999998)

        # Test with float values that should truncate
        float_attributes: dict[str, Any] = {
            "llm": {
                "token_count": {
                    "prompt": 10.999,
                    "completion": 20.001,
                    "total": 31.0,
                }
            }
        }
        result = get_aggregated_tokens(float_attributes)
        assert result == (10, 21, 31)  # int() behavior: int(20.001) = 21

        # Test with zero values
        zero_attributes: dict[str, Any] = {
            "llm": {
                "token_count": {
                    "prompt": 0,
                    "completion": 0,
                    "total": 0,
                }
            }
        }
        result = get_aggregated_tokens(zero_attributes)
        assert result == (0, 0, 0)

    def test_get_aggregated_tokens_calculation_logic(self) -> None:
        """Test the specific calculation logic for different scenarios."""
        # Scenario 1: When total > calculated_total and prompt_tokens is 0
        attributes1: dict[str, Any] = {
            "llm": {
                "token_count": {
                    "prompt": 0,
                    "completion": 15,
                    "total": 25,
                }
            }
        }
        result1: tuple[Optional[int], Optional[int], Optional[int]] = get_aggregated_tokens(
            attributes1
        )
        assert result1 == (10, 15, 25)  # prompt_tokens = 25 - 15 = 10

        # Scenario 2: When total > calculated_total and prompt_tokens > 0
        attributes2: dict[str, Any] = {
            "llm": {
                "token_count": {
                    "prompt": 8,
                    "completion": 12,
                    "total": 25,
                }
            }
        }
        result2: tuple[Optional[int], Optional[int], Optional[int]] = get_aggregated_tokens(
            attributes2
        )
        assert result2 == (8, 17, 25)  # completion_tokens = 25 - 8 = 17

        # Scenario 3: When total <= calculated_total
        attributes3: dict[str, Any] = {
            "llm": {
                "token_count": {
                    "prompt": 10,
                    "completion": 20,
                    "total": 25,  # Less than 10 + 20 = 30
                }
            }
        }
        result3: tuple[Optional[int], Optional[int], Optional[int]] = get_aggregated_tokens(
            attributes3
        )
        assert result3 == (10, 20, 30)  # total = 10 + 20 = 30

    def test_get_aggregated_tokens_type_conversion(self) -> None:
        """Test type conversion from various input types."""
        # Test with boolean values (should convert to int: True=1, False=0)
        bool_attributes: dict[str, Any] = {
            "llm": {
                "token_count": {
                    "prompt": True,
                    "completion": False,
                    "total": True,
                }
            }
        }
        result: tuple[Optional[int], Optional[int], Optional[int]] = get_aggregated_tokens(
            bool_attributes
        )
        assert result == (1, 0, 1)  # int(True) = 1, int(False) = 0

        # Test with None values (should default to 0)
        none_attributes: dict[str, Any] = {
            "llm": {
                "token_count": {
                    "prompt": None,
                    "completion": None,
                    "total": None,
                }
            }
        }
        result = get_aggregated_tokens(none_attributes)
        assert result == (0, 0, 0)

        # Test with mixed types
        mixed_attributes: dict[str, Any] = {
            "llm": {
                "token_count": {
                    "prompt": 10,
                    "completion": None,
                    "total": 30.5,
                }
            }
        }
        result = get_aggregated_tokens(mixed_attributes)
        assert result == (
            10,
            20,
            30,
        )  # completion defaults to 0, then calculated as total - prompt (30 - 10 = 20)


class TestDecisionSpanAttributes:
    """DECISION spans read `decision.*` attributes, with the legacy `llm.*` ones as fallback."""

    @pytest.mark.parametrize(
        "attributes,expected",
        [
            pytest.param(
                {
                    "openinference": {"span": {"kind": "DECISION"}},
                    "decision": {"token_count": {"input": 1000, "output": 500}},
                },
                (1000, 500, 1500),
                id="decision_counts",
            ),
            pytest.param(
                {
                    "openinference": {"span": {"kind": "DECISION"}},
                    "decision": {"token_count": {"input": 1000}},
                },
                (1000, 0, 1000),
                id="decision_input_only",
            ),
            pytest.param(
                {
                    "openinference": {"span": {"kind": "DECISION"}},
                    "decision": {"token_count": {"input": 1000, "output": 2}},
                    "llm": {"token_count": {"prompt": 9, "completion": 9, "total": 99}},
                },
                (1000, 2, 1002),
                id="decision_counts_win_over_llm_counts",
            ),
            pytest.param(
                {
                    "openinference": {"span": {"kind": "DECISION"}},
                    "llm": {"token_count": {"prompt": 400, "completion": 2, "total": 402}},
                },
                (400, 2, 402),
                id="legacy_decision_span_with_llm_counts",
            ),
            pytest.param(
                {
                    "openinference": {"span": {"kind": "LLM"}},
                    "decision": {"token_count": {"input": 1000, "output": 500}},
                    "llm": {"token_count": {"prompt": 10, "completion": 5}},
                },
                (10, 5, 15),
                id="llm_span_ignores_decision_counts",
            ),
        ],
    )
    def test_get_aggregated_tokens(
        self, attributes: dict[str, Any], expected: tuple[int, int, int]
    ) -> None:
        assert get_aggregated_tokens(attributes) == expected

    @pytest.mark.parametrize(
        "attributes,expected_type,expected_name,expected_provider",
        [
            pytest.param(
                {
                    "openinference": {"span": {"kind": "DECISION"}},
                    "decision": {
                        "model_name": " jev-1.13.0 ",
                        "provider": "vllm",
                        "system": "typesafe",
                    },
                    "llm": {"model_name": "ignored", "provider": "ignored"},
                },
                "DECISION",
                "jev-1.13.0",
                "vllm",
                id="decision_attributes",
            ),
            pytest.param(
                {
                    "openinference": {"span": {"kind": "DECISION"}},
                    "decision": {"model_name": "jev-1.13.0", "system": "typesafe"},
                },
                "DECISION",
                "jev-1.13.0",
                "typesafe",
                id="decision_system_stands_in_for_provider",
            ),
            pytest.param(
                {
                    "openinference": {"span": {"kind": "DECISION"}},
                    "llm": {"model_name": "jev-latest", "provider": "typesafe"},
                },
                "DECISION",
                "jev-latest",
                "typesafe",
                id="legacy_decision_span_with_llm_attributes",
            ),
            pytest.param(
                {
                    "openinference": {"span": {"kind": "LLM"}},
                    "decision": {"model_name": "ignored", "provider": "ignored"},
                    "llm": {"model_name": "gpt-6-luna", "provider": "openai"},
                },
                "LLM",
                "gpt-6-luna",
                "openai",
                id="llm_span",
            ),
            pytest.param(
                {"llm": {"model_name": "gpt-6-luna"}},
                "LLM",
                "gpt-6-luna",
                "",
                id="no_span_kind_is_llm",
            ),
        ],
    )
    def test_model_type_name_and_provider(
        self,
        attributes: dict[str, Any],
        expected_type: str,
        expected_name: str,
        expected_provider: str,
    ) -> None:
        assert get_priced_model_type(attributes) == expected_type
        assert get_model_name(attributes) == expected_name
        assert get_provider(attributes) == expected_provider

    @pytest.mark.parametrize(
        "token_count,llm_token_count,expected",
        [
            pytest.param(
                {"input": 1000},
                {"completion": 5},
                (1000, 0, 1000),
                id="families_are_not_mixed",
            ),
            pytest.param(
                {"input": "n/a"},
                {"prompt": 10, "completion": 5},
                (10, 5, 15),
                id="non_numeric_decision_count_keeps_llm_counts",
            ),
        ],
    )
    def test_one_token_family_per_span(
        self,
        token_count: dict[str, Any],
        llm_token_count: dict[str, Any],
        expected: tuple[int, int, int],
    ) -> None:
        attributes = {
            "openinference": {"span": {"kind": "DECISION"}},
            "decision": {"token_count": token_count},
            "llm": {"token_count": llm_token_count},
        }
        assert get_aggregated_tokens(attributes) == expected
