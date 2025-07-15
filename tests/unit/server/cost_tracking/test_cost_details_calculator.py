from typing import Any, Mapping, NamedTuple, Optional

import pytest

from phoenix.db import models
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
            assert set(actual_details.keys()) == set(
                expected_details.keys()
            ), f"Expected {domain} details to have the same keys"
            for token_type, expected in expected_details.items():
                detail = actual_details[token_type]
                assert (
                    detail.tokens == expected.tokens
                ), f"Expected {domain} detail for {token_type} to have {expected.tokens} tokens"  # noqa: E501
                if expected.cost is not None:
                    assert detail.cost == pytest.approx(
                        expected.cost
                    ), f"Expected {domain} detail for {token_type} to have {expected.cost} cost"  # noqa: E501
                else:
                    assert (
                        detail.cost is None
                    ), f"Expected {domain} detail for {token_type} to have no cost"  # noqa: E501
                if expected.cost_per_token is not None:
                    assert (
                        detail.cost_per_token == pytest.approx(expected.cost_per_token)
                    ), f"Expected {domain} detail for {token_type} to have {expected.cost_per_token} cost per token"  # noqa: E501
                else:
                    assert (
                        detail.cost_per_token is None
                    ), f"Expected {domain} detail for {token_type} to have no cost per token"

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
