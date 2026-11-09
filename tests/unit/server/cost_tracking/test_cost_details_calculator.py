from typing import Any, Mapping, NamedTuple, Optional

import pytest

from phoenix.db import models
from phoenix.db.types.token_price_customization import ThresholdBasedTokenPriceCustomization
from phoenix.server.cost_tracking.cost_details_calculator import SpanCostDetailsCalculator


class _Cost(NamedTuple):
    """
    Represents the expected cost breakdown for a token type in tests.

    This named tuple is used to define expected results in test cases,
    allowing us to specify tokens, cost, and cost_per_token separately.

    Attributes:
        tokens: Expected number of tokens (converted to int)
        cost: Expected total cost for this token type (None if no calculator)
        cost_per_token: Expected cost per token (None if no calculator or zero tokens)
    """

    tokens: Optional[int] = None
    cost: Optional[float] = None
    cost_per_token: Optional[float] = None


class TestSpanCostDetailsCalculator:
    """
    Comprehensive test suite for SpanCostDetailsCalculator.

    This test suite covers the cost calculation logic for LLM spans, including:

    - Basic functionality with aggregated token counts
    - Detailed token processing with specific token types
    - Fallback behavior when token types don't have specific calculators
    - Edge cases (floats, negatives, invalid types)
    - Mixed scenarios (some token types have calculators, others don't)
    - Error conditions (missing required token types)
    - Zero cost rate behavior
    - Token accounting edge cases (detailed tokens exceeding totals)
    - Missing or malformed data handling

    **Key Testing Areas:**
    - Fallback calculation: Token types without specific calculators fall back to
      "input" (for prompt tokens) or "output" (for completion tokens)
    - Remaining token calculation: When detailed tokens are less than total tokens
    - Cost-per-token edge cases: Proper handling of None vs 0.0 values
    - Data validation: Graceful handling of invalid or missing token data

    Test Strategy:
    1. Parametrized tests cover the main functionality with various scenarios
    2. Separate test methods handle error conditions and edge cases
    3. Each test case focuses on a specific aspect of the calculation logic
    4. Tests use only allowed token types: image, audio, video, document, input, output, reasoning
    """

    @pytest.mark.parametrize(
        "attributes,expected_prompt_details,expected_completion_details,prices",
        [
            # Basic functionality tests
            pytest.param(
                {},  # Empty attributes
                {},
                {},
                [
                    models.TokenPrice(token_type="input", is_prompt=True, base_rate=0.001),
                    models.TokenPrice(token_type="output", is_prompt=False, base_rate=0.002),
                ],
                id="empty_attributes",
            ),
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": 0,
                            "completion": 0,
                        }
                    }
                },
                {},
                {},
                [
                    models.TokenPrice(token_type="input", is_prompt=True, base_rate=0.001),
                    models.TokenPrice(token_type="output", is_prompt=False, base_rate=0.002),
                ],
                id="zero_tokens",
            ),
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": 10,
                            "completion": 20,
                        }
                    }
                },
                {
                    "input": _Cost(tokens=10, cost=0.01, cost_per_token=0.001),
                },
                {
                    "output": _Cost(tokens=20, cost=0.04, cost_per_token=0.002),
                },
                [
                    models.TokenPrice(token_type="input", is_prompt=True, base_rate=0.001),
                    models.TokenPrice(token_type="output", is_prompt=False, base_rate=0.002),
                ],
                id="basic_aggregated_tokens",
            ),
            # Detailed token processing tests
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": 100,
                            "completion": 50,
                            "prompt_details": {
                                "input": 100,  # input already in details
                            },
                            "completion_details": {
                                "output": 50,  # output already in details
                            },
                        }
                    }
                },
                {
                    "input": _Cost(tokens=100, cost=0.1, cost_per_token=0.001),
                },
                {
                    "output": _Cost(tokens=50, cost=0.1, cost_per_token=0.002),
                },
                [
                    models.TokenPrice(token_type="input", is_prompt=True, base_rate=0.001),
                    models.TokenPrice(token_type="output", is_prompt=False, base_rate=0.002),
                ],
                id="default_types_in_details",
            ),
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": 100,
                            "completion": 50,
                            "prompt_details": {
                                "audio": 20,
                                "video": 80,
                            },
                            "completion_details": {
                                "output": 50,
                            },
                        }
                    }
                },
                {
                    "audio": _Cost(tokens=20, cost=0.02, cost_per_token=0.001),
                    "video": _Cost(tokens=80, cost=0.08, cost_per_token=0.001),
                },
                {
                    "output": _Cost(tokens=50, cost=0.1, cost_per_token=0.002),
                },
                [
                    models.TokenPrice(token_type="input", is_prompt=True, base_rate=0.001),
                    models.TokenPrice(token_type="output", is_prompt=False, base_rate=0.002),
                ],
                id="detailed_tokens_no_remaining",
            ),
            # All allowed token types test
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": 200,
                            "completion": 100,
                            "prompt_details": {
                                "image": 30,
                                "audio": 40,
                                "video": 50,
                                "document": 80,
                            },
                            "completion_details": {
                                "reasoning": 60,
                                "output": 40,
                            },
                        }
                    }
                },
                {
                    "image": _Cost(
                        tokens=30, cost=0.03, cost_per_token=0.001
                    ),  # Falls back to input calculator
                    "audio": _Cost(
                        tokens=40, cost=0.04, cost_per_token=0.001
                    ),  # Falls back to input calculator
                    "video": _Cost(
                        tokens=50, cost=0.05, cost_per_token=0.001
                    ),  # Falls back to input calculator
                    "document": _Cost(
                        tokens=80, cost=0.08, cost_per_token=0.001
                    ),  # Falls back to input calculator
                },
                {
                    "reasoning": _Cost(
                        tokens=60, cost=0.12, cost_per_token=0.002
                    ),  # Falls back to output calculator
                    "output": _Cost(tokens=40, cost=0.08, cost_per_token=0.002),
                },
                [
                    models.TokenPrice(token_type="input", is_prompt=True, base_rate=0.001),
                    models.TokenPrice(token_type="output", is_prompt=False, base_rate=0.002),
                ],
                id="all_allowed_token_types",
            ),
            # Mixed calculator scenarios
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": 100,
                            "completion": 50,
                            "prompt_details": {
                                "image": 30,
                                "audio": 40,
                                "video": 30,
                            },
                            "completion_details": {
                                "reasoning": 25,
                                "output": 25,
                            },
                        }
                    }
                },
                {
                    "image": _Cost(
                        tokens=30, cost=0.03, cost_per_token=0.001
                    ),  # Falls back to input calculator
                    "audio": _Cost(tokens=40, cost=0.02, cost_per_token=0.0005),
                    "video": _Cost(
                        tokens=30, cost=0.03, cost_per_token=0.001
                    ),  # Falls back to input calculator
                },
                {
                    "reasoning": _Cost(tokens=25, cost=0.075, cost_per_token=0.003),
                    "output": _Cost(tokens=25, cost=0.05, cost_per_token=0.002),
                },
                [
                    models.TokenPrice(token_type="input", is_prompt=True, base_rate=0.001),
                    models.TokenPrice(token_type="audio", is_prompt=True, base_rate=0.0005),
                    models.TokenPrice(token_type="output", is_prompt=False, base_rate=0.002),
                    models.TokenPrice(token_type="reasoning", is_prompt=False, base_rate=0.003),
                ],
                id="mixed_calculator_scenarios",
            ),
            # Edge cases
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": 100,
                            "completion": 50,
                            "prompt_details": {
                                "image": 10.5,
                                "audio": 20.7,
                            },
                            "completion_details": {
                                "output": 30.3,
                            },
                        }
                    }
                },
                {
                    "image": _Cost(
                        tokens=10, cost=0.01, cost_per_token=0.001
                    ),  # Falls back to input calculator
                    "audio": _Cost(
                        tokens=20, cost=0.02, cost_per_token=0.001
                    ),  # Falls back to input calculator
                    "input": _Cost(tokens=70, cost=0.07, cost_per_token=0.001),
                },
                {
                    "output": _Cost(tokens=30, cost=0.06, cost_per_token=0.002),
                },
                [
                    models.TokenPrice(token_type="input", is_prompt=True, base_rate=0.001),
                    models.TokenPrice(token_type="output", is_prompt=False, base_rate=0.002),
                ],
                id="float_token_counts",
            ),
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": 100,
                            "completion": 50,
                            "prompt_details": {
                                "image": -5,
                                "audio": 0,
                            },
                            "completion_details": {
                                "output": 50,
                            },
                        }
                    }
                },
                {
                    "image": _Cost(
                        tokens=0, cost=0.0, cost_per_token=None
                    ),  # Falls back to input calculator, but 0 tokens
                    "audio": _Cost(
                        tokens=0, cost=0.0, cost_per_token=None
                    ),  # Falls back to input calculator, but 0 tokens
                    "input": _Cost(tokens=100, cost=0.1, cost_per_token=0.001),
                },
                {
                    "output": _Cost(tokens=50, cost=0.1, cost_per_token=0.002),
                },
                [
                    models.TokenPrice(token_type="input", is_prompt=True, base_rate=0.001),
                    models.TokenPrice(token_type="output", is_prompt=False, base_rate=0.002),
                ],
                id="negative_and_zero_token_counts",
            ),
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": 100,
                            "completion": 50,
                            "prompt_details": {
                                "image": "invalid",
                                "audio": None,
                            },
                            "completion_details": {
                                "output": 50,
                            },
                        }
                    }
                },
                {
                    "input": _Cost(tokens=100, cost=0.1, cost_per_token=0.001),
                },
                {
                    "output": _Cost(tokens=50, cost=0.1, cost_per_token=0.002),
                },
                [
                    models.TokenPrice(token_type="input", is_prompt=True, base_rate=0.001),
                    models.TokenPrice(token_type="output", is_prompt=False, base_rate=0.002),
                ],
                id="invalid_token_count_types",
            ),
            # Token accounting edge cases
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": 50,
                            "completion": 25,
                            "prompt_details": {
                                "image": 30,
                                "audio": 30,
                            },
                            "completion_details": {
                                "reasoning": 15,
                                "video": 15,
                            },
                        }
                    }
                },
                {
                    "image": _Cost(
                        tokens=30, cost=0.03, cost_per_token=0.001
                    ),  # Falls back to input calculator
                    "audio": _Cost(
                        tokens=30, cost=0.03, cost_per_token=0.001
                    ),  # Falls back to input calculator
                },
                {
                    "reasoning": _Cost(
                        tokens=15, cost=0.03, cost_per_token=0.002
                    ),  # Falls back to output calculator
                    "video": _Cost(
                        tokens=15, cost=0.03, cost_per_token=0.002
                    ),  # Falls back to output calculator
                },
                [
                    models.TokenPrice(token_type="input", is_prompt=True, base_rate=0.001),
                    models.TokenPrice(token_type="output", is_prompt=False, base_rate=0.002),
                ],
                id="detailed_tokens_exceed_totals_no_remaining",
            ),
            # Large token counts
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": 10000,
                            "completion": 5000,
                            "prompt_details": {
                                "image": 3000,
                                "audio": 4000,
                                "video": 3000,
                            },
                            "completion_details": {
                                "reasoning": 2000,
                                "output": 3000,
                            },
                        }
                    }
                },
                {
                    "image": _Cost(
                        tokens=3000, cost=3.0, cost_per_token=0.001
                    ),  # Falls back to input calculator
                    "audio": _Cost(
                        tokens=4000, cost=4.0, cost_per_token=0.001
                    ),  # Falls back to input calculator
                    "video": _Cost(
                        tokens=3000, cost=3.0, cost_per_token=0.001
                    ),  # Falls back to input calculator
                },
                {
                    "reasoning": _Cost(
                        tokens=2000, cost=4.0, cost_per_token=0.002
                    ),  # Falls back to output calculator
                    "output": _Cost(tokens=3000, cost=6.0, cost_per_token=0.002),
                },
                [
                    models.TokenPrice(token_type="input", is_prompt=True, base_rate=0.001),
                    models.TokenPrice(token_type="output", is_prompt=False, base_rate=0.002),
                ],
                id="large_token_counts",
            ),
            # All calculators scenario
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": 100,
                            "completion": 50,
                            "prompt_details": {
                                "image": 20,
                                "audio": 30,
                                "video": 25,
                                "document": 25,
                            },
                            "completion_details": {
                                "reasoning": 30,
                                "output": 20,
                            },
                        }
                    }
                },
                {
                    "image": _Cost(tokens=20, cost=0.02, cost_per_token=0.001),
                    "audio": _Cost(tokens=30, cost=0.015, cost_per_token=0.0005),
                    "video": _Cost(tokens=25, cost=0.0375, cost_per_token=0.0015),
                    "document": _Cost(tokens=25, cost=0.025, cost_per_token=0.001),
                },
                {
                    "reasoning": _Cost(tokens=30, cost=0.09, cost_per_token=0.003),
                    "output": _Cost(tokens=20, cost=0.04, cost_per_token=0.002),
                },
                [
                    models.TokenPrice(token_type="input", is_prompt=True, base_rate=0.001),
                    models.TokenPrice(token_type="image", is_prompt=True, base_rate=0.001),
                    models.TokenPrice(token_type="audio", is_prompt=True, base_rate=0.0005),
                    models.TokenPrice(token_type="video", is_prompt=True, base_rate=0.0015),
                    models.TokenPrice(token_type="document", is_prompt=True, base_rate=0.001),
                    models.TokenPrice(token_type="output", is_prompt=False, base_rate=0.002),
                    models.TokenPrice(token_type="reasoning", is_prompt=False, base_rate=0.003),
                ],
                id="all_calculators_scenario",
            ),
            # Additional missing test cases
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": 100,
                            "completion": 50,
                            "prompt_details": {
                                "image": 30,
                            },
                            "completion_details": {
                                "reasoning": 20,
                            },
                        }
                    }
                },
                {
                    "image": _Cost(
                        tokens=30, cost=0.03, cost_per_token=0.001
                    ),  # Falls back to input
                    "input": _Cost(tokens=70, cost=0.07, cost_per_token=0.001),  # Remaining tokens
                },
                {
                    "reasoning": _Cost(
                        tokens=20, cost=0.04, cost_per_token=0.002
                    ),  # Falls back to output
                    "output": _Cost(tokens=30, cost=0.06, cost_per_token=0.002),  # Remaining tokens
                },
                [
                    models.TokenPrice(token_type="input", is_prompt=True, base_rate=0.001),
                    models.TokenPrice(token_type="output", is_prompt=False, base_rate=0.002),
                ],
                id="detailed_tokens_with_remaining",
            ),
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": 50,
                            # Missing completion
                        }
                    }
                },
                {
                    "input": _Cost(tokens=50, cost=0.05, cost_per_token=0.001),
                },
                {},  # No completion details
                [
                    models.TokenPrice(token_type="input", is_prompt=True, base_rate=0.001),
                    models.TokenPrice(token_type="output", is_prompt=False, base_rate=0.002),
                ],
                id="only_prompt_tokens",
            ),
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "completion": 30,
                            # Missing prompt
                        }
                    }
                },
                {},  # No prompt details
                {
                    "output": _Cost(tokens=30, cost=0.06, cost_per_token=0.002),
                },
                [
                    models.TokenPrice(token_type="input", is_prompt=True, base_rate=0.001),
                    models.TokenPrice(token_type="output", is_prompt=False, base_rate=0.002),
                ],
                id="only_completion_tokens",
            ),
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": 50,
                            "completion": 30,
                            "prompt_details": {},  # Empty details dict
                            "completion_details": {},  # Empty details dict
                        }
                    }
                },
                {
                    "input": _Cost(tokens=50, cost=0.05, cost_per_token=0.001),
                },
                {
                    "output": _Cost(tokens=30, cost=0.06, cost_per_token=0.002),
                },
                [
                    models.TokenPrice(token_type="input", is_prompt=True, base_rate=0.001),
                    models.TokenPrice(token_type="output", is_prompt=False, base_rate=0.002),
                ],
                id="empty_details_dicts",
            ),
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": 50,
                            "completion": 30,
                            "prompt_details": "not_a_dict",  # Invalid type
                            "completion_details": None,  # Invalid type
                        }
                    }
                },
                {
                    "input": _Cost(tokens=50, cost=0.05, cost_per_token=0.001),
                },
                {
                    "output": _Cost(tokens=30, cost=0.06, cost_per_token=0.002),
                },
                [
                    models.TokenPrice(token_type="input", is_prompt=True, base_rate=0.001),
                    models.TokenPrice(token_type="output", is_prompt=False, base_rate=0.002),
                ],
                id="invalid_details_types",
            ),
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": 100,
                            "completion": 50,
                            "prompt_details": {
                                "image": 50,
                                "audio": 60,  # Sum exceeds prompt total
                            },
                            "completion_details": {
                                "reasoning": 40,
                                "video": 20,  # Sum exceeds completion total
                            },
                        }
                    }
                },
                {
                    "image": _Cost(
                        tokens=50, cost=0.05, cost_per_token=0.001
                    ),  # Falls back to input
                    "audio": _Cost(
                        tokens=60, cost=0.06, cost_per_token=0.001
                    ),  # Falls back to input
                },
                {
                    "reasoning": _Cost(
                        tokens=40, cost=0.08, cost_per_token=0.002
                    ),  # Falls back to output
                    "video": _Cost(
                        tokens=20, cost=0.04, cost_per_token=0.002
                    ),  # Falls back to output
                },
                [
                    models.TokenPrice(token_type="input", is_prompt=True, base_rate=0.001),
                    models.TokenPrice(token_type="output", is_prompt=False, base_rate=0.002),
                ],
                id="detailed_tokens_exceed_totals",
            ),
            # Zero cost rate scenarios
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": 100,
                            "completion": 50,
                        }
                    }
                },
                {
                    "input": _Cost(
                        tokens=100, cost=0.0, cost_per_token=0.0
                    ),  # 0.0 cost means None cost_per_token
                },
                {
                    "output": _Cost(
                        tokens=50, cost=0.0, cost_per_token=0.0
                    ),  # 0.0 cost means None cost_per_token
                },
                [
                    models.TokenPrice(token_type="input", is_prompt=True, base_rate=0.0),
                    models.TokenPrice(token_type="output", is_prompt=False, base_rate=0.0),
                ],
                id="zero_cost_rates",
            ),
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": 100,
                            "completion": 50,
                            "prompt_details": {
                                "image": 100,
                            },
                            "completion_details": {
                                "output": 50,
                            },
                        }
                    }
                },
                {
                    "image": _Cost(
                        tokens=100, cost=0.0, cost_per_token=0.0
                    ),  # Falls back to input with 0 rate, so cost_per_token is 0.0
                },
                {
                    "output": _Cost(tokens=50, cost=0.1, cost_per_token=0.002),
                },
                [
                    models.TokenPrice(
                        token_type="input", is_prompt=True, base_rate=0.0
                    ),  # Zero rate
                    models.TokenPrice(token_type="output", is_prompt=False, base_rate=0.002),
                ],
                id="zero_cost_rate_with_fallback",
            ),
            pytest.param(
                {
                    "llm": {
                        "token_count": {
                            "prompt": 100,
                            "completion": 50,
                            "prompt_details": {
                                "image": 30,
                                "audio": 40,
                                "video": 30,
                            },
                            "completion_details": {
                                "reasoning": 25,
                                "output": 25,
                            },
                        }
                    }
                },
                {
                    "image": _Cost(tokens=30, cost=None, cost_per_token=None),
                    "audio": _Cost(tokens=40, cost=None, cost_per_token=None),
                    "video": _Cost(tokens=30, cost=None, cost_per_token=None),
                },
                {
                    "reasoning": _Cost(tokens=25, cost=None, cost_per_token=None),
                    "output": _Cost(tokens=25, cost=None, cost_per_token=None),
                },
                [],  # empty prices
                id="no_prices_provided_records_tokens_but_not_costs",
            ),
        ],
    )
    def test_calculate_details(
        self,
        attributes: Mapping[str, Any],
        expected_prompt_details: dict[str, _Cost],
        expected_completion_details: dict[str, _Cost],
        prices: list[models.TokenPrice],
    ) -> None:
        """
        Comprehensive test for calculate_details method covering all scenarios.

        This test validates the cost calculation logic for various combinations of:
        - Token count types (aggregated vs detailed)
        - Token price configurations (which token types have calculators)
        - Edge cases and error conditions

        Args:
            attributes: Mock span attributes containing token count data
            expected_prompt_details: Expected prompt token details with costs
            expected_completion_details: Expected completion token details with costs
            prices: Token price configuration for the calculator
        """
        calculator = SpanCostDetailsCalculator(prices)
        result = calculator.calculate_details(attributes)

        # Separate prompt and completion details
        prompt_details = {detail.token_type: detail for detail in result if detail.is_prompt}
        completion_details = {
            detail.token_type: detail for detail in result if not detail.is_prompt
        }

        for domain, actual_details, expected_details in [
            ("prompt", prompt_details, expected_prompt_details),
            ("completion", completion_details, expected_completion_details),
        ]:
            assert set(actual_details.keys()) == set(expected_details.keys()), (
                f"Expected {domain} details to have the same keys"
            )
            for token_type, expected in expected_details.items():
                detail = actual_details[token_type]
                assert detail.tokens == expected.tokens, (
                    f"Expected {domain} detail for {token_type} to have {expected.tokens} tokens"
                )
                if expected.cost is not None:
                    assert detail.cost == pytest.approx(expected.cost), (
                        f"Expected {domain} detail for {token_type} to have {expected.cost} cost"
                    )
                else:
                    assert detail.cost is None, (
                        f"Expected {domain} detail for {token_type} to have no cost"
                    )
                if expected.cost_per_token is not None:
                    assert detail.cost_per_token == pytest.approx(expected.cost_per_token), (
                        f"Expected {domain} detail for {token_type} to have {expected.cost_per_token} cost per token"
                    )
                else:
                    assert detail.cost_per_token is None, (
                        f"Expected {domain} detail for {token_type} to have no cost per token"
                    )

    def test_missing_token_count_section(self) -> None:
        """
        Test handling of spans without token count data.

        This test verifies that the calculator gracefully handles:
        - Missing llm.token_count entirely
        - Malformed token_count structure
        - Non-dict token_count values
        """
        calculator = SpanCostDetailsCalculator(
            [
                models.TokenPrice(token_type="input", is_prompt=True, base_rate=0.001),
                models.TokenPrice(token_type="output", is_prompt=False, base_rate=0.002),
            ]
        )

        # Test missing llm.token_count entirely
        result = calculator.calculate_details({"llm": {}})
        assert result == []

        # Test missing llm section entirely
        result = calculator.calculate_details({"other": "data"})
        assert result == []

        # Test non-dict token_count
        result = calculator.calculate_details({"llm": {"token_count": "not_a_dict"}})
        assert result == []

        result = calculator.calculate_details({"llm": {"token_count": None}})
        assert result == []

        result = calculator.calculate_details({"llm": {"token_count": 123}})
        assert result == []

    def test_cost_per_token_edge_cases(self) -> None:
        """
        Test edge cases for cost_per_token calculation.

        This test verifies proper handling of:
        - Cost per token when cost is None (no calculator available)
        - Cost per token when cost is 0 but tokens > 0
        - Cost per token when both cost and tokens are 0
        """
        # Create calculator without specific calculators for image/audio
        calculator = SpanCostDetailsCalculator(
            [
                models.TokenPrice(token_type="input", is_prompt=True, base_rate=0.001),
                models.TokenPrice(token_type="output", is_prompt=False, base_rate=0.002),
            ]
        )

        # Test case where we have tokens but cost is calculated (fallback behavior)
        result = calculator.calculate_details(
            {
                "llm": {
                    "token_count": {
                        "prompt": 100,
                        "completion": 50,
                        "prompt_details": {"image": 50},
                        "completion_details": {"reasoning": 25},
                    }
                }
            }
        )

        # Verify that all details have proper cost_per_token calculations
        for detail in result:
            if detail.tokens and detail.tokens > 0:
                if detail.cost is not None and detail.cost > 0:
                    assert detail.cost_per_token is not None
                    assert detail.cost_per_token == detail.cost / detail.tokens
                elif detail.cost == 0.0:
                    assert detail.cost_per_token == 0.0
            else:
                assert detail.cost_per_token is None

    def test_span_cost_append_detail_preserves_zero_cost(self) -> None:
        span_cost = models.SpanCost()
        span_cost.append_detail(
            models.SpanCostDetail(
                token_type="input", is_prompt=True, tokens=100, cost=0.0, cost_per_token=0.0
            )
        )
        span_cost.append_detail(
            models.SpanCostDetail(
                token_type="output", is_prompt=False, tokens=50, cost=0.0, cost_per_token=0.0
            )
        )
        assert span_cost.prompt_cost == 0.0
        assert span_cost.completion_cost == 0.0
        assert span_cost.total_cost == 0.0

        unpriced = models.SpanCost()
        unpriced.append_detail(
            models.SpanCostDetail(
                token_type="input", is_prompt=True, tokens=100, cost=None, cost_per_token=None
            )
        )
        assert unpriced.prompt_cost is None
        assert unpriced.total_cost is None


def _tier(base_rate: float, new_rate: float, key: str) -> dict[str, Any]:
    return {
        "base_rate": base_rate,
        "customization": ThresholdBasedTokenPriceCustomization(
            key=key, threshold=272_000, new_rate=new_rate
        ),
    }


def _luna_decision_prices(tier_key: str = "llm.token_count.prompt") -> list[models.TokenPrice]:
    """
    gpt-6-luna on the Decisions API: chat input and cache rates with the 272k tier, $0 output.
    The default tier key is the one the LLM manifest entry uses.
    """
    return [
        models.TokenPrice(token_type="input", is_prompt=True, **_tier(1e-7, 2e-7, tier_key)),
        models.TokenPrice(token_type="output", is_prompt=False, **_tier(0.0, 0.0, tier_key)),
        models.TokenPrice(token_type="cache_read", is_prompt=True, **_tier(1e-8, 2e-8, tier_key)),
        models.TokenPrice(
            token_type="cache_write", is_prompt=True, **_tier(1.25e-7, 2.5e-7, tier_key)
        ),
    ]


def _decision_span(**token_count: int) -> dict[str, Any]:
    return {
        "openinference": {"span": {"kind": "DECISION"}},
        "decision": {"model_name": "gpt-6-luna", "token_count": token_count},
    }


def _by_type(details: list[models.SpanCostDetail]) -> dict[str, _Cost]:
    return {
        d.token_type: _Cost(
            tokens=None if d.tokens is None else int(d.tokens),
            cost=d.cost,
            cost_per_token=d.cost_per_token,
        )
        for d in details
    }


class TestDecisionSpanCostDetails:
    def test_decision_counts_are_priced(self) -> None:
        calculator = SpanCostDetailsCalculator(_luna_decision_prices())
        details = _by_type(calculator.calculate_details(_decision_span(input=1000, output=500)))
        assert details.keys() == {"input", "output"}
        assert details["input"].tokens == 1000
        assert details["input"].cost == pytest.approx(1e-4)
        assert details["output"] == _Cost(tokens=500, cost=0.0, cost_per_token=0.0)

    def test_no_output_tokens_gives_no_output_detail(self) -> None:
        calculator = SpanCostDetailsCalculator(_luna_decision_prices())
        details = _by_type(calculator.calculate_details(_decision_span(input=1000, output=0)))
        assert details.keys() == {"input"}

    def test_272k_tier_applies_to_decision_input(self) -> None:
        calculator = SpanCostDetailsCalculator(_luna_decision_prices())
        details = _by_type(calculator.calculate_details(_decision_span(input=300_000, output=10)))
        assert details["input"].cost == pytest.approx(300_000 * 2e-7)
        assert details["output"].cost == 0.0

        details = _by_type(calculator.calculate_details(_decision_span(input=272_000, output=10)))
        assert details["input"].cost == pytest.approx(272_000 * 1e-7)

    def test_llm_detail_attributes_are_ignored_with_decision_counts(self) -> None:
        # The decision attributes have no detail keys; `llm.token_count.*_details` next to
        # `decision.token_count.*` would be subtracted from counts they don't belong to.
        attributes = _decision_span(input=1000, output=5)
        attributes["llm"] = {
            "token_count": {
                "prompt_details": {"cache_read": 400, "cache_write": 100},
                "completion_details": {"reasoning": 3},
            }
        }
        calculator = SpanCostDetailsCalculator(_luna_decision_prices())
        details = _by_type(calculator.calculate_details(attributes))
        assert details.keys() == {"input", "output"}
        assert details["input"].tokens == 1000
        assert details["input"].cost == pytest.approx(1000 * 1e-7)

    def test_legacy_decision_span_prices_cache_details_and_tier(self) -> None:
        # TypeSafe instrumentor releases before the decision.* attributes set llm.* on
        # DECISION spans; the cache rates and the 272k tier then apply as on an LLM span.
        attributes = {
            "openinference": {"span": {"kind": "DECISION"}},
            "llm": {
                "model_name": "gpt-6-luna",
                "token_count": {
                    "prompt": 300_000,
                    "completion": 10,
                    "prompt_details": {"cache_read": 200_000, "cache_write": 50_000},
                },
            },
        }
        calculator = SpanCostDetailsCalculator(_luna_decision_prices())
        details = _by_type(calculator.calculate_details(attributes))
        assert details["cache_read"].cost == pytest.approx(200_000 * 2e-8)
        assert details["cache_write"].cost == pytest.approx(50_000 * 2.5e-7)
        assert details["input"].tokens == 50_000
        assert details["input"].cost == pytest.approx(50_000 * 2e-7)
        assert details["output"].cost == 0.0

    def test_unpriced_decision_model(self) -> None:
        calculator = SpanCostDetailsCalculator([])
        details = _by_type(calculator.calculate_details(_decision_span(input=412, output=2)))
        assert details == {
            "input": _Cost(tokens=412, cost=None, cost_per_token=None),
            "output": _Cost(tokens=2, cost=None, cost_per_token=None),
        }

    def test_tier_reads_the_counts_being_priced(self) -> None:
        # With decision counts present, a tier keyed on llm.token_count.prompt is decided by
        # decision.token_count.input, not by a stray llm.* count.
        calculator = SpanCostDetailsCalculator(_luna_decision_prices())
        attributes = _decision_span(input=300_000, output=1)
        attributes["llm"] = {"token_count": {"prompt": 0}}
        details = _by_type(calculator.calculate_details(attributes))
        assert details["input"].cost == pytest.approx(300_000 * 2e-7)

        attributes = _decision_span(input=1000, output=1)
        attributes["llm"] = {"token_count": {"prompt": 300_000}}
        details = _by_type(calculator.calculate_details(attributes))
        assert details["input"].cost == pytest.approx(1000 * 1e-7)

    @pytest.mark.parametrize(
        "attributes, input_cost_per_token",
        [
            pytest.param(_decision_span(input=300_000, output=1), 2e-7, id="decision-span"),
            pytest.param(
                {
                    "openinference": {"span": {"kind": "DECISION"}},
                    "llm": {
                        "model_name": "gpt-6-luna",
                        "token_count": {"prompt": 300_000, "completion": 1},
                    },
                },
                2e-7,
                id="legacy-llm-keys-decision-span",
            ),
            pytest.param(
                {
                    "openinference": {"span": {"kind": "LLM"}},
                    "llm": {
                        "model_name": "gpt-6-luna",
                        "token_count": {"prompt": 300_000, "completion": 1},
                    },
                },
                1e-7,
                id="llm-span-ignores-decision-key",
            ),
        ],
    )
    def test_tier_keyed_on_decision_input(
        self, attributes: dict[str, Any], input_cost_per_token: float
    ) -> None:
        calculator = SpanCostDetailsCalculator(_luna_decision_prices("decision.token_count.input"))
        details = _by_type(calculator.calculate_details(attributes))
        assert details["input"].tokens == 300_000
        assert details["input"].cost_per_token == pytest.approx(input_cost_per_token)
        assert details["input"].cost == pytest.approx(300_000 * input_cost_per_token)

    def test_llm_span_tier_ignores_decision_counts(self) -> None:
        calculator = SpanCostDetailsCalculator(_luna_decision_prices())
        attributes = {
            "openinference": {"span": {"kind": "LLM"}},
            "llm": {"token_count": {"completion": 10, "total": 1010}},
            "decision": {"token_count": {"input": 300_000}},
        }
        details = _by_type(calculator.calculate_details(attributes))
        assert details["input"].cost == pytest.approx(1000 * 1e-7)
