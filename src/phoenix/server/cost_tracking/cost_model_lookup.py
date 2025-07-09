import re
from datetime import datetime
from typing import Any, Iterable, Mapping, Optional

from openinference.semconv.trace import SpanAttributes
from typing_extensions import TypeAlias

from phoenix.datetime_utils import is_timezone_aware
from phoenix.db import models
from phoenix.server.cost_tracking import regex_specificity
from phoenix.trace.attributes import get_attribute_value

_RegexPatternStr: TypeAlias = str
_RegexSpecificityScore: TypeAlias = int
_TieBreakerId: TypeAlias = int


class CostModelLookup:
    def __init__(
        self,
        generative_models: Iterable[models.GenerativeModel] = (),
    ) -> None:
        self._models = tuple(generative_models)
        self._model_priority: dict[
            int, tuple[_RegexSpecificityScore, float, _TieBreakerId]
        ] = {}  # higher is better
        self._regex_specificity_score: dict[re.Pattern[str], _RegexSpecificityScore] = {}

        for m in self._models:
            self._regex_specificity_score[m.name_pattern] = regex_specificity.score(m.name_pattern)

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
            start_time: The timestamp for which to find a model. Must be timezone-aware.
                Models with start_time greater than this value will be excluded.
            attributes: A mapping containing span attributes. Must include:
                - SpanAttributes.LLM_MODEL_NAME: The name of the LLM model to match
                - SpanAttributes.LLM_PROVIDER: (Optional) The provider of the LLM model

        Raises:
            TypeError: If start_time is not timezone-aware (tzinfo is None)

        Returns:
            The most appropriate GenerativeModel that matches the criteria, or None if no
            suitable model is found.

        Model Selection Logic:
            1. **Input Validation**: Returns None if model name is empty or whitespace-only
            2. **Time and Regex Filtering**: Only models that satisfy both conditions:
               - start_time <= start_time or start_time=None (active models)
               - name_pattern regex matches the model name from attributes
            3. **Early Return Optimization**: If only one candidate remains, return it immediately
            4. **Two-Tier Priority System**: Models are processed in tiers:
               - User-defined models (is_built_in=False) are processed first
               - Built-in models (is_built_in=True) are processed second
               - If a tier has only one model, return it immediately
            5. **Provider Filtering**: Within each tier, if provider is specified:
               - Prefer models with matching provider
               - Fall back to provider-agnostic models if no provider-specific matches exist
            6. **Priority Selection**: Select the model with the highest priority tuple:
               (regex_specificity_score, start_time.timestamp, tie_breaker)

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
        # 1. extract and validate inputs
        if not is_timezone_aware(start_time):
            raise TypeError("start_time must be timezone-aware")

        model_name = str(
            get_attribute_value(attributes, SpanAttributes.LLM_MODEL_NAME) or ""
        ).strip()
        if not model_name:
            return None

        # 2. only include models that are active and match the regex pattern
        candidates = [
            model
            for model in self._models
            if (not model.start_time or model.start_time <= start_time)
            and model.name_pattern.search(model_name)
        ]
        if not candidates:
            return None

        # 3. early return: if only one candidate remains, return it
        if len(candidates) == 1:
            return candidates[0]

        provider = str(get_attribute_value(attributes, SpanAttributes.LLM_PROVIDER) or "").strip()

        # 4. priority-based selection: user-defined models first, then built-in models
        for is_built_in in (False, True):  # False = user-defined, True = built-in
            # get candidates for current tier (user-defined or built-in)
            tier_candidates = [model for model in candidates if model.is_built_in == is_built_in]

            if not tier_candidates:
                continue  # try next tier

            # early return: if only one candidate in this tier, return it
            if len(tier_candidates) == 1:
                return tier_candidates[0]

            # 5. provider filtering: if provider specified, prefer provider-specific models
            if provider:
                provider_specific_models = [
                    model
                    for model in tier_candidates
                    if model.provider and model.provider == provider
                ]
                # only use provider-specific models if any exist
                # this allows fallback to provider-agnostic models when no match
                if provider_specific_models:
                    tier_candidates = provider_specific_models

            # 6. select best model in this tier
            return max(tier_candidates, key=lambda model: self._model_priority[model.id])

        # 7. no suitable model found
        return None
