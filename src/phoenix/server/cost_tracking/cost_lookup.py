import re
from collections import defaultdict
from dataclasses import dataclass
from typing import Any, Iterator, Optional, Union

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from phoenix.db import models


@dataclass
class ModelTokenCost:
    model_id: int
    input: Optional[float] = None
    output: Optional[float] = None
    cache_write: Optional[float] = None
    cache_read: Optional[float] = None
    prompt_audio: Optional[float] = None
    completion_audio: Optional[float] = None
    reasoning: Optional[float] = None


class RegexDict:
    __slots__ = ("_entries",)

    def __init__(self) -> None:
        self._entries: list[tuple[re.Pattern[str], Any]] = []

    def __setitem__(self, pattern: Union[str, re.Pattern[str]], value: Any) -> None:
        if isinstance(pattern, str):
            compiled = re.compile(pattern)
        elif isinstance(pattern, re.Pattern):
            compiled = pattern
        else:
            raise TypeError("RegexDict key must be a str or re.Pattern")

        for idx, (existing_pat, _) in enumerate(self._entries):
            if existing_pat.pattern == compiled.pattern and existing_pat.flags == compiled.flags:
                self._entries[idx] = (compiled, value)
                return
        self._entries.append((compiled, value))

    def __delitem__(self, pattern: Union[str, re.Pattern[str]]) -> None:
        if isinstance(pattern, str):
            target = pattern
        elif isinstance(pattern, re.Pattern):
            target = pattern.pattern
        else:
            raise TypeError("RegexDict key must be a str or re.Pattern")

        for idx, (existing_pat, _) in enumerate(self._entries):
            if existing_pat.pattern == target:
                del self._entries[idx]
                return
        raise KeyError(pattern)

    def __getitem__(self, key: str) -> Any:
        for pattern, value in self._entries:
            if pattern.fullmatch(key):
                return value
        raise KeyError(key)

    def __contains__(self, key: str) -> bool:
        try:
            _ = self[key]
            return True
        except KeyError:
            return False

    def __iter__(self) -> Iterator[tuple[str, Any]]:
        for pattern, value in self._entries:
            yield pattern.pattern, value

    def __len__(self) -> int:
        return len(self._entries)


class ModelCostLookup:
    __slots__ = ("_provider_model_map", "_model_map", "_overrides", "_cache", "_max_cache_size")

    def __init__(self) -> None:
        # Each provider maps to a *RegexDict* of (pattern -> cost).
        self._provider_model_map: defaultdict[Optional[str], RegexDict] = defaultdict(RegexDict)
        # Map from *pattern string* to a set of providers that have that pattern.
        self._model_map: defaultdict[re.Pattern[str], set[Optional[str]]] = defaultdict(set)
        # A prioritized list of cost overrides (later overrides have higher priority).
        self._overrides: list[tuple[Optional[str], re.Pattern[str], ModelTokenCost]] = []
        # Cache for computed costs keyed by (provider, model_name).
        self._cache: dict[tuple[Optional[str], str], list[tuple[str, ModelTokenCost]]] = {}
        self._max_cache_size = 100

    def add_pattern(
        self, provider: Optional[str], pattern: re.Pattern[str], cost: ModelTokenCost
    ) -> None:
        """Register a model pattern with its cost."""

        assert isinstance(pattern, re.Pattern), "pattern must be a compiled regex"
        self._provider_model_map[provider][pattern] = cost
        self._model_map[pattern].add(provider)
        self._cache.clear()

    def remove_pattern(self, provider: Optional[str], pattern: re.Pattern[str]) -> None:
        """Remove a previously-registered model pattern."""

        assert isinstance(pattern, re.Pattern), "pattern must be a compiled regex"
        if provider not in self._provider_model_map:
            return
        del self._provider_model_map[provider][pattern]
        self._model_map[pattern].discard(provider)
        if not self._provider_model_map[provider]:
            del self._provider_model_map[provider]
        if not self._model_map[pattern]:
            del self._model_map[pattern]
        self._cache.clear()

    def get_cost(
        self, provider: Optional[str], model_name: str
    ) -> list[tuple[str, ModelTokenCost]]:
        key = (provider, model_name)
        if key in self._cache:
            value = self._cache.pop(key)
            self._cache[key] = value
            return value

        result = self._lookup_cost(provider, model_name)

        if len(self._cache) >= self._max_cache_size:
            self._cache.pop(next(iter(self._cache)))

        self._cache[key] = result
        return result

    def has_model(self, provider: Optional[str], model_name: str) -> bool:
        """Return ``True`` if a cost (either base or overridden) exists for the model."""

        return self._contains(provider, model_name)

    def pattern_count(self) -> int:
        """Return the number of registered *base* patterns (overrides not counted)."""

        return sum(len(regex_dict) for regex_dict in self._provider_model_map.values())

    def _lookup_cost(
        self, provider: Optional[str], model_name: str
    ) -> list[tuple[str, ModelTokenCost]]:
        assert isinstance(model_name, str), "Lookup key must be a str"
        # 1) Provider-specific lookup
        if provider is not None:
            override_cost = self._lookup_override(provider, model_name)
            if override_cost is not None:
                return [(provider, override_cost)]

            regex_dict = self._provider_model_map.get(provider)
            if regex_dict is None:
                raise KeyError(provider)
            return [(provider, regex_dict[model_name])]

        # 2) provider-agnostic lookup
        provider_cost_map: dict[str, ModelTokenCost] = {}
        for p, regex_dict in self._provider_model_map.items():
            try:
                provider_cost_map[p] = regex_dict[model_name]  # type: ignore
            except KeyError:
                continue

        for override_provider, override_pattern, override_cost in self._overrides:
            if override_pattern.fullmatch(model_name):
                if override_provider is None:
                    for p in list(provider_cost_map):
                        provider_cost_map[p] = override_cost
                else:
                    provider_cost_map[override_provider] = override_cost

        if not provider_cost_map:
            raise KeyError(model_name)
        return list(provider_cost_map.items())

    def _contains(self, provider: Optional[str], model_name: str) -> bool:
        if provider is None:
            if any(pat.fullmatch(model_name) for _, pat, _ in self._overrides):
                return True
            return any(model_name in regex_dict for regex_dict in self._provider_model_map.values())

        if self._lookup_override(provider, model_name) is not None:
            return True

        regex_dict = self._provider_model_map.get(provider)
        if not regex_dict:
            return False
        return model_name in regex_dict

    def add_override(
        self, provider: Optional[str], pattern: re.Pattern[str], cost: ModelTokenCost
    ) -> None:
        """Register a *prioritized* cost override.

        Overrides are evaluated in the order in which they are added (LIFO).
        """

        if not isinstance(pattern, re.Pattern):
            raise TypeError("pattern must be a compiled regex")
        self._overrides.append((provider, pattern, cost))
        self._cache.clear()

    def _lookup_override(
        self, provider: Optional[str], model_name: str
    ) -> Optional[ModelTokenCost]:
        """Return the cost from the highest-priority override that matches, or *None*."""

        for override_provider, override_pattern, override_cost in reversed(self._overrides):
            provider_matches = override_provider is None or override_provider == provider
            if provider_matches and override_pattern.fullmatch(model_name):
                return override_cost
        return None


async def _create_cost_table(session: AsyncSession) -> "ModelCostLookup":
    lookup = ModelCostLookup()

    result = await session.execute(
        select(models.GenerativeModel)
        .options(joinedload(models.GenerativeModel.token_prices))
        .order_by(models.GenerativeModel.id)
    )
    db_models = result.unique().scalars().all()

    for model in db_models:
        token_cost = ModelTokenCost(model_id=model.id)
        pattern = re.compile(model.llm_name_pattern)
        for cost in model.token_prices:
            setattr(token_cost, cost.token_type, cost.base_rate)
            if model.is_override:
                lookup.add_override(model.provider, pattern, token_cost)
            else:
                lookup.add_pattern(model.provider, pattern, token_cost)

    return lookup


COST_TABLE: Optional[ModelCostLookup] = None


async def initialize_cost_table(session: AsyncSession) -> ModelCostLookup:
    global COST_TABLE
    if COST_TABLE is None:
        COST_TABLE = await _create_cost_table(session)
    return COST_TABLE


def get_cost_table() -> ModelCostLookup:
    global COST_TABLE
    if COST_TABLE is None:
        raise RuntimeError("Cost table not initialized")
    return COST_TABLE
