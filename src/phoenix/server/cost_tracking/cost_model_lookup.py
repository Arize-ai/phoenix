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
_IsUserDefined: TypeAlias = bool
_TieBreakerId: TypeAlias = int


class CostModelLookup:
    def __init__(
        self,
        generative_models: Iterable[models.GenerativeModel],
    ) -> None:
        self._models = tuple(generative_models)
        self._model_priority: dict[
            int, tuple[_IsUserDefined, _RegexSpecificityScore, _TieBreakerId]
        ] = {}  # higher is better
        self._regex: dict[_RegexPatternStr, re.Pattern[Any]] = {}
        self._regex_specificity_score: dict[_RegexPatternStr, _RegexSpecificityScore] = {}

        for m in self._models:
            if (pattern_str := m.llm_name_pattern) not in self._regex:
                self._regex[pattern_str] = re.compile(m.llm_name_pattern)
                self._regex_specificity_score[pattern_str] = regex_specificity.score(pattern_str)

            # For non-override models, use negative ID so that lower IDs win (more predictable)
            # For override models, use positive ID so they always win over non-overrides
            tie_breaker = m.id if m.is_override else -m.id

            self._model_priority[m.id] = (
                m.is_override,
                self._regex_specificity_score[m.llm_name_pattern],
                tie_breaker,
            )

    def find_model(
        self,
        start_time: datetime,
        attributes: Mapping[str, Any],
    ) -> Optional[models.GenerativeModel]:
        llm_name = str(get_attribute_value(attributes, SpanAttributes.LLM_MODEL_NAME) or "").strip()
        if not llm_name:
            return None

        candidates: list[models.GenerativeModel] = list(self._models)

        llm_provider = str(
            get_attribute_value(attributes, SpanAttributes.LLM_PROVIDER) or ""
        ).strip()
        if llm_provider:
            candidates = [c for c in candidates if c.provider and c.provider == llm_provider]
            if not candidates:
                return None

        candidates = [c for c in candidates if not c.start_time or c.start_time <= start_time]
        if not candidates:
            return None

        candidates = [
            c
            for c in candidates
            if c.llm_name_pattern and self._regex[c.llm_name_pattern].match(llm_name)
        ]
        if not candidates:
            return None

        return sorted(candidates, key=lambda c: self._model_priority[c.id])[-1]
