from itertools import chain
from typing import Any, Iterable, Mapping

from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.cost_tracking.helpers import get_aggregated_tokens
from phoenix.server.cost_tracking.token_cost_calculator import (
    TokenCostCalculator,
    create_token_cost_calculator,
)
from phoenix.trace.attributes import get_attribute_value

_TokenType: TypeAlias = str


class SpanCostDetailsCalculator:
    """
    Calculates detailed cost breakdowns for LLM spans based on token usage and pricing.

    This calculator processes both detailed token counts (from span attributes) and
    aggregated token totals to provide comprehensive cost analysis for prompt and
    completion tokens. It handles multiple token types (e.g., "input", "output",
    "image", "audio", "video", "document", "reasoning", etc.) and calculates costs
    using configured pricing models with fallback behavior.

    **Fallback Behavior:**
    - If a specific token type has a configured calculator, it uses that calculator
    - If no specific calculator exists, it falls back to the default calculator:
      - Prompt tokens (is_prompt=True) fall back to "input" calculator
      - Completion tokens (is_prompt=False) fall back to "output" calculator

    This ensures all token types get cost calculations even if not explicitly configured.

    The calculator expects token prices to include at least:
    - An "input" token type for prompt tokens (used as fallback for unconfigured prompt token types)
    - An "output" token type for completion tokens (used as fallback for unconfigured completion token types)

    Additional token types can be configured for more granular cost tracking.
    """  # noqa: E501

    def __init__(
        self,
        prices: Iterable[models.TokenPrice],
    ) -> None:
        """
        Initialize the cost calculator with token pricing configuration.

        Args:
            prices: Collection of token price configurations defining rates for
                   different token types and whether they're prompt or completion tokens.

        Raises:
            ValueError: If required "input" (prompt) or "output" (completion)
                       token types are missing from the pricing configuration.
        """
        # Create calculators for prompt token types (is_prompt=True)
        self._prompt: Mapping[_TokenType, TokenCostCalculator] = {
            p.token_type: create_token_cost_calculator(p.base_rate, p.customization)
            for p in prices
            if p.is_prompt
        }
        if "input" not in self._prompt:
            raise ValueError("Token prices for prompt must include an 'input' token type")

        # Create calculators for completion token types (is_prompt=False)
        self._completion: Mapping[_TokenType, TokenCostCalculator] = {
            p.token_type: create_token_cost_calculator(p.base_rate, p.customization)
            for p in prices
            if not p.is_prompt
        }
        if "output" not in self._completion:
            raise ValueError("Token prices for completion must include an 'output' token type")

    def calculate_details(
        self,
        attributes: Mapping[str, Any],
    ) -> list[models.SpanCostDetail]:
        """
        Calculate detailed cost breakdown for a given span.

        This method processes token usage in two phases:
        1. **Detailed token processing**: Extracts specific token counts from span attributes
           (e.g., "llm.token_count.prompt_details", "llm.token_count.completion_details")
           and calculates costs for each token type found. Uses fallback behavior for
           token types without specific calculators.

        2. **Aggregated token processing**: For default token types ("input"/"output") that
           weren't found in detailed processing, calculates remaining tokens by subtracting
           detailed counts from total aggregated tokens.

        **Fallback Calculation Logic:**
        - For each token type in detailed processing:
          - If a specific calculator exists for the token type, use it
          - Otherwise, fall back to the default calculator ("input" for prompt tokens,
            "output" for completion tokens)
        - This ensures all token types receive cost calculations regardless of
          specific calculator configuration

        Args:
            attributes: Dictionary containing span attributes with token usage data.

        Returns:
            List of SpanCostDetail objects containing token counts, costs, and cost-per-token
            for each token type found in the span.

        Note:
            - Token counts are validated and converted to non-negative integers
            - All token types receive cost calculations via fallback mechanism
            - Cost-per-token is calculated only when both cost and token count are positive
            - If cost is 0.0, cost-per-token will be None (not 0.0) due to falsy evaluation
        """
        prompt_details: dict[_TokenType, models.SpanCostDetail] = {}
        completion_details: dict[_TokenType, models.SpanCostDetail] = {}

        # Phase 1: Process detailed token counts from span attributes
        for is_prompt, prefix, calculators, results in (
            (True, "prompt", self._prompt, prompt_details),
            (False, "completion", self._completion, completion_details),
        ):
            # Extract detailed token counts from span attributes
            details = get_attribute_value(attributes, f"llm.token_count.{prefix}_details")
            if isinstance(details, dict) and details:
                for token_type, token_count in details.items():
                    # Validate token count is numeric
                    if not isinstance(token_count, (int, float)):
                        continue
                    tokens = max(0, int(token_count))

                    # Calculate cost using specific calculator or fallback to default
                    if token_type in calculators:
                        # Use specific calculator for this token type
                        calculator = calculators[token_type]
                    else:
                        # Fallback to default calculator: "input" for prompts,
                        # "output" for completions
                        key = "input" if is_prompt else "output"
                        calculator = calculators[key]
                    cost = calculator.calculate_cost(attributes, tokens)

                    # Calculate cost per token (avoid division by zero)
                    cost_per_token = cost / tokens if tokens else None

                    detail = models.SpanCostDetail(
                        token_type=token_type,
                        is_prompt=is_prompt,
                        tokens=tokens,
                        cost=cost,
                        cost_per_token=cost_per_token,
                    )
                    results[token_type] = detail

        # Get aggregated token totals for fallback calculations
        prompt_tokens, completion_tokens, _ = get_aggregated_tokens(attributes)

        # Phase 2: Process remaining tokens for default token types
        for is_prompt, token_type, total, calculators, results in (
            (True, "input", prompt_tokens, self._prompt, prompt_details),
            (False, "output", completion_tokens, self._completion, completion_details),
        ):
            # Skip if this token type was already processed in detailed phase
            if token_type in results:
                continue

            # Calculate remaining tokens by subtracting detailed counts from total
            tokens = total - sum(
                int(d.tokens or 0) for d in results.values() if d.is_prompt == is_prompt
            )

            # Skip if no remaining tokens or negative (shouldn't happen with valid data)
            if tokens <= 0:
                continue

            # Calculate cost using guaranteed default calculator (input/output are required)
            cost = calculators[token_type].calculate_cost(attributes, tokens)

            # Calculate cost per token (avoid division by zero)
            cost_per_token = cost / tokens if cost and tokens else None

            detail = models.SpanCostDetail(
                token_type=token_type,
                is_prompt=is_prompt,
                tokens=tokens,
                cost=cost,
                cost_per_token=cost_per_token,
            )
            results[token_type] = detail

        # Return combined results from both prompt and completion processing
        return list(chain(prompt_details.values(), completion_details.values()))
