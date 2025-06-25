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
    "system", "user", etc.) and calculates costs using configured pricing models.

    The calculator expects token prices to include at least:
    - An "input" token type for prompt tokens
    - An "output" token type for completion tokens

    Additional token types can be configured for more granular cost tracking.
    """

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
           and calculates costs for each token type found.

        2. **Aggregated token processing**: For default token types ("input"/"output") that
           weren't found in detailed processing, calculates remaining tokens by subtracting
           detailed counts from total aggregated tokens.

        Args:
            span: The span containing token usage data and attributes for cost calculation.

        Returns:
            List of SpanCostDetail objects containing token counts, costs, and cost-per-token
            for each token type found in the span.

        Note:
            - Token counts are validated and converted to non-negative integers
            - Costs are calculated only if a calculator exists for the token type
            - Cost-per-token is calculated only when both cost and token count are positive
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

                    # Calculate cost if calculator exists for this token type
                    if token_type in calculators:
                        calculator = calculators[token_type]
                    else:
                        key = "input" if is_prompt else "output"
                        calculator = calculators[key]
                    cost = calculator.calculate_cost(attributes, tokens)

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

            # Calculate cost if calculator exists for this token type
            # input/output are guaranteed to exist
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
