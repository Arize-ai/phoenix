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
            2. **Provider Filtering**: If provider is specified in attributes, only models
               with matching provider are considered. Provider-agnostic models (provider=None)
               are excluded when a specific provider is given.
            3. **Time Filtering**: Only models with start_time <= start_time or start_time=None
               are considered
            4. **Priority Selection**: Models are selected based on a three-tier priority system:
               - User-defined models (is_built_in=False) are checked first
               - Built-in models (is_built_in=True) are checked second
               - Within each tier, models are sorted by priority tuple:
                 (start_time.timestamp, regex_specificity_score, tie_breaker)
               - Higher priority models (later in sorted list) are checked first
            5. **Regex Matching**: The first model whose name_pattern matches the
               model name from attributes is returned

        Priority Tuple Components:
            - start_time.timestamp: Models with later start times have higher priority
            - regex_specificity_score: More specific regex patterns have higher priority
            - tie_breaker: For built-in models, uses negative ID (lower IDs win);
              for user-defined models, uses positive ID (higher IDs win)

        Examples:
            >>> lookup = CostModelLookup([model1, model2, model3])
            >>> model = lookup.find_model(
            ...     start_time=datetime(2024, 1, 1, tzinfo=timezone.utc),
            ...     attributes={"llm": {"model_name": "gpt-3.5-turbo", "provider": "openai"}}
            ... )
        """
        llm_name = str(get_attribute_value(attributes, SpanAttributes.LLM_MODEL_NAME) or "").strip()
        if not llm_name:
            return None

        candidates: list[models.GenerativeModel] = list(self._models)

        # Remove candidates by start_time
        candidates_matched_by_time = [
            c for c in candidates if not c.start_time or c.start_time <= start_time
        ]
        if not candidates_matched_by_time:
            return None
        candidates = candidates_matched_by_time

        # Remove candidates by name_pattern
        candidates_matched_by_name = [
            c for c in candidates if self._regex[c.name_pattern].match(llm_name)
        ]
        if not candidates_matched_by_name:
            return None
        candidates = candidates_matched_by_name

        if len(candidates) == 1:
            return candidates[0]

        llm_provider = str(
            get_attribute_value(attributes, SpanAttributes.LLM_PROVIDER) or ""
        ).strip()

        for is_built_in in (False, True):
            candidates_subset = [c for c in candidates if c.is_built_in == is_built_in]

            if not candidates_subset:
                continue

            if llm_provider:
                provider_specific_candidates = [
                    c for c in candidates_subset if c.provider and c.provider == llm_provider
                ]
                if provider_specific_candidates:
                    candidates_subset = provider_specific_candidates

            if len(candidates_subset) == 1:
                return candidates_subset[0]

            if candidates_subset:
                return sorted(
                    candidates_subset,
                    key=lambda m: self._model_priority[m.id],
                    reverse=True,
                )[0]

        return None
