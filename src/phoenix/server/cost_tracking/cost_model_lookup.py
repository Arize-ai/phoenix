import re
from datetime import datetime
from typing import Any, Iterable, Mapping, Optional

from openinference.semconv.trace import SpanAttributes
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.cost_tracking import regex_specificity
from phoenix.trace.attributes import get_attribute_value

_RegexPatternStr: TypeAlias = str
_RegexSpecificityScore: TypeAlias = int
_TieBreakerId: TypeAlias = int


class CostModelLookup:
    def __init__(
        self,
        generative_models: Iterable[models.GenerativeModel],
    ) -> None:
        self._models = tuple(generative_models)
        self._model_priority: dict[
            int, tuple[_RegexSpecificityScore, float, _TieBreakerId]
        ] = {}  # higher is better
        self._regex: dict[_RegexPatternStr, re.Pattern[Any]] = {}
        self._regex_specificity_score: dict[_RegexPatternStr, _RegexSpecificityScore] = {}

        for m in self._models:
            if (pattern_str := m.name_pattern) not in self._regex:
                self._regex[pattern_str] = re.compile(m.name_pattern)
                self._regex_specificity_score[pattern_str] = regex_specificity.score(pattern_str)

            # For built-in models, use negative ID so that earlier IDs win
            # For user-defined models, use positive ID so later IDs win
            tie_breaker = -m.id if m.is_built_in else m.id

            self._model_priority[m.id] = (
                self._regex_specificity_score[m.name_pattern],
                m.start_time.timestamp() if m.start_time else 0.0,
                tie_breaker,
            )

    def find_model(
        self,
        start_time: datetime,
        attributes: Mapping[str, Any],
    ) -> Optional[models.GenerativeModel]:
        """
        Find the most appropriate generative model for cost tracking based on attributes and time.

        This method implements a sophisticated model lookup system that filters and prioritizes
        generative models based on the provided attributes and timestamp. The lookup follows
        a specific priority hierarchy to ensure consistent and predictable model selection.

        Args:
            start_time: The timestamp for which to find a model. Models with start_time
                greater than this value will be excluded.
            attributes: A mapping containing span attributes. Must include:
                - SpanAttributes.LLM_MODEL_NAME: The name of the LLM model to match
                - SpanAttributes.LLM_PROVIDER: (Optional) The provider of the LLM model

        Returns:
            The most appropriate GenerativeModel that matches the criteria, or None if no
            suitable model is found.

        Model Selection Logic:
            1. **Input Validation**: Returns None if model name is empty or whitespace-only
            2. **Time Filtering**: Only models with start_time <= start_time or start_time=None
               are considered
            3. **Regex Matching**: Only models whose name_pattern matches the
               model name from attributes are considered
            4. **Provider Filtering**: If provider is specified in attributes, only models
               with matching provider are considered. Provider-agnostic models (provider=None)
               are excluded when a specific provider is given.
            5. **Priority Selection**: Models are selected based on a two-tier priority system:
               - User-defined models (is_built_in=False) are checked first
               - Built-in models (is_built_in=True) are checked second
               - Within each tier, models are sorted by priority tuple:
                 (regex_specificity_score, start_time.timestamp, tie_breaker)
               - Higher priority models (later in sorted list) are checked first

        Priority Tuple Components:
            - regex_specificity_score: More specific regex patterns have higher priority
            - start_time.timestamp: Models with later start times have higher priority
            - tie_breaker: For built-in models, uses negative ID (lower IDs win);
              for user-defined models, uses positive ID (higher IDs win)

        Examples:
            >>> lookup = CostModelLookup([model1, model2, model3])
            >>> model = lookup.find_model(
            ...     start_time=datetime(2024, 1, 1, tzinfo=timezone.utc),
            ...     attributes={"llm": {"model_name": "gpt-3.5-turbo", "provider": "openai"}}
            ... )
        """  # noqa: E501
        # Step 1: Extract and validate the model name from attributes
        llm_name = str(get_attribute_value(attributes, SpanAttributes.LLM_MODEL_NAME) or "").strip()
        if not llm_name:
            return None

        # Step 2: Start with all available models as candidates
        candidates: list[models.GenerativeModel] = list(self._models)

        # Step 3: Filter candidates by start_time - exclude models that are not yet active
        # Models with start_time=None are always included (they're always active)
        # Models with start_time > start_time are excluded (they haven't started yet)
        candidates_matched_by_time = [
            c for c in candidates if not c.start_time or c.start_time <= start_time
        ]
        if not candidates_matched_by_time:
            return None
        candidates = candidates_matched_by_time

        # Step 4: Filter candidates by regex pattern matching
        # Only include models whose name_pattern regex matches the provided model name
        candidates_matched_by_name = [
            c for c in candidates if self._regex[c.name_pattern].match(llm_name)
        ]
        if not candidates_matched_by_name:
            return None
        candidates = candidates_matched_by_name

        # Step 5: Early return if only one candidate remains
        if len(candidates) == 1:
            return candidates[0]

        # Step 6: Extract provider from attributes (if specified)
        llm_provider = str(
            get_attribute_value(attributes, SpanAttributes.LLM_PROVIDER) or ""
        ).strip()

        # Step 7: Apply priority-based selection in two tiers
        # First check user-defined models (is_built_in=False), then built-in models
        # (is_built_in=True)
        for is_built_in in (False, True):
            # Filter candidates to current tier (user-defined or built-in)
            candidates_subset = [c for c in candidates if c.is_built_in == is_built_in]

            if not candidates_subset:
                continue

            # Step 8: Apply provider filtering if provider is specified in attributes
            # If a specific provider is given, prefer provider-specific models over
            # provider-agnostic ones, but only if provider-specific models are available
            if llm_provider:
                provider_specific_candidates = [
                    c for c in candidates_subset if c.provider and c.provider == llm_provider
                ]
                # Only use provider-specific candidates if any exist
                # This allows fallback to provider-agnostic models when no provider-specific
                # match exists
                if provider_specific_candidates:
                    candidates_subset = provider_specific_candidates

            # Step 9: Early return if only one candidate in current tier
            if len(candidates_subset) == 1:
                return candidates_subset[0]

            # Step 10: Sort remaining candidates by priority and return the highest priority
            # one. Priority tuple: (regex_specificity_score, start_time.timestamp, tie_breaker)
            # Higher values in the tuple = higher priority
            if candidates_subset:
                return sorted(
                    candidates_subset,
                    key=lambda m: self._model_priority[m.id],
                    reverse=True,
                )[0]

        # Step 11: No suitable model found
        return None
