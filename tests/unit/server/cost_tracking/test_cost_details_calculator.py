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
    - Edge cases (floats, negatives, invalid types)
    - Mixed scenarios (some token types have calculators, others don't)
    - Error conditions (missing required token types)
    - Zero cost rate behavior

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
                    "audio": _Cost(tokens=20),
                    "video": _Cost(tokens=80),
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
                    "image": _Cost(tokens=30),
                    "audio": _Cost(tokens=40),
                    "video": _Cost(tokens=50),
                    "document": _Cost(tokens=80),
                },
                {
                    "reasoning": _Cost(tokens=60),
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
                    "image": _Cost(tokens=30),
                    "audio": _Cost(tokens=40, cost=0.02, cost_per_token=0.0005),
                    "video": _Cost(tokens=30),
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
                    "image": _Cost(tokens=10),
                    "audio": _Cost(tokens=20),
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
                    "image": _Cost(tokens=0),
                    "audio": _Cost(tokens=0),
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
                    "image": _Cost(tokens=30),
                    "audio": _Cost(tokens=30),
                },
                {
                    "reasoning": _Cost(tokens=15),
                    "video": _Cost(tokens=15),
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
                    "image": _Cost(tokens=3000),
                    "audio": _Cost(tokens=4000),
                    "video": _Cost(tokens=3000),
                },
                {
                    "reasoning": _Cost(tokens=2000),
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

    def test_missing_required_token_types(self) -> None:
        """
        Test that missing required token types raise ValueError.

        The SpanCostDetailsCalculator requires at least:
        - One "input" token type for prompt tokens
        - One "output" token type for completion tokens

        This test verifies that appropriate errors are raised when these
        requirements are not met.
        """
        # Missing input token type
        with pytest.raises(
            ValueError, match="Token prices for prompt must include an 'input' token type"
        ):
            SpanCostDetailsCalculator(
                [
                    models.TokenPrice(token_type="output", is_prompt=False, base_rate=0.002),
                ]
            )

        # Missing output token type
        with pytest.raises(
            ValueError, match="Token prices for completion must include an 'output' token type"
        ):
            SpanCostDetailsCalculator(
                [
                    models.TokenPrice(token_type="input", is_prompt=True, base_rate=0.001),
                ]
            )
