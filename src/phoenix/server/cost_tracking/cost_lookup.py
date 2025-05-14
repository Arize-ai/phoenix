import re
from collections import defaultdict
from typing import Any, Iterator, NamedTuple, Optional, Union


class RegexDict:
    __slots__ = ("_entries",)

    def __init__(self):
        self._entries: list[tuple[re.Pattern, Any]] = []

    def __setitem__(self, pattern: Union[str, re.Pattern], value: Any) -> None:
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

    def __delitem__(self, pattern: Union[str, re.Pattern]) -> None:
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


class CostOverride(NamedTuple):
    provider: Optional[str]
    pattern: re.Pattern
    cost: float


class ModelPattern(NamedTuple):
    provider: Optional[str]
    pattern: re.Pattern


class ModelName(NamedTuple):
    provider: Optional[str]
    name: str


class ModelCostLookup:
    __slots__ = ("_provider_model_map", "_model_map", "_overrides")

    def __init__(self):
        # Each provider maps to a *RegexDict* of (pattern -> cost).
        self._provider_model_map = defaultdict(RegexDict)
        # Map from *pattern string* to a set of providers that have that pattern.
        self._model_map = defaultdict(set)
        # A prioritized list of cost overrides (later overrides have higher priority).
        self._overrides: list[CostOverride] = []

    def add_pattern(self, pattern: ModelPattern, cost: float) -> None:
        """Register a model pattern with its cost."""

        assert isinstance(pattern, ModelPattern), "pattern must be a ModelPattern"
        provider, regex = pattern.provider, pattern.pattern
        self._provider_model_map[provider][regex] = cost
        self._model_map[regex].add(provider)

    def remove_pattern(self, pattern: ModelPattern) -> None:
        """Remove a previously-registered model pattern."""

        assert isinstance(pattern, ModelPattern), "pattern must be a ModelPattern"
        provider, regex = pattern.provider, pattern.pattern
        del self._provider_model_map[provider][regex]
        self._model_map[regex].discard(provider)
        if not self._provider_model_map[provider]:
            del self._provider_model_map[provider]
        if not self._model_map[regex]:
            del self._model_map[regex]

    def get_cost(self, name: ModelName):
        """Return the cost for the given model *name*.

        For provider-agnostic queries (``provider is None``) a list of *(provider, cost)*
        tuples is returned; otherwise a single ``float`` is returned.
        """

        return self._lookup_cost(name)

    def has_model(self, name: ModelName) -> bool:
        """Return ``True`` if a cost (either base or overridden) exists for *name*."""

        return self._contains(name)

    def pattern_count(self) -> int:
        """Return the number of registered *base* patterns (overrides not counted)."""

        return sum(len(regex_dict) for regex_dict in self._provider_model_map.values())

    def _lookup_cost(self, key: ModelName):
        assert isinstance(key, ModelName), "Lookup key must be a ModelName"
        provider, model_name = key.provider, key.name
        # [logic copied from previous __getitem__ implementation]
        # 1) Provider-specific lookup
        if provider is not None:
            override_cost = self._lookup_override(provider, model_name)
            if override_cost is not None:
                return override_cost

            regex_dict = self._provider_model_map.get(provider)
            if regex_dict is None:
                raise KeyError(provider)
            return regex_dict[model_name]

        # 2) provider-agnostic lookup
        provider_cost_map: dict[str, float] = {}
        for p, regex_dict in self._provider_model_map.items():
            try:
                provider_cost_map[p] = regex_dict[model_name]
            except KeyError:
                continue

        for override in self._overrides:
            if override.pattern.fullmatch(model_name):
                if override.provider is None:
                    for p in list(provider_cost_map):
                        provider_cost_map[p] = override.cost
                else:
                    provider_cost_map[override.provider] = override.cost

        if not provider_cost_map:
            raise KeyError(model_name)
        return list(provider_cost_map.items())

    def _contains(self, key: ModelName) -> bool:
        provider, model_name = key.provider, key.name

        if provider is None:
            if any(ov.pattern.fullmatch(model_name) for ov in self._overrides):
                return True
            return any(model_name in regex_dict for regex_dict in self._provider_model_map.values())

        if self._lookup_override(provider, model_name) is not None:
            return True

        regex_dict = self._provider_model_map.get(provider)
        if not regex_dict:
            return False
        return model_name in regex_dict

    def add_override(self, override: CostOverride) -> None:
        """Register a *prioritized* cost override.

        Overrides are evaluated in the order in which they are added *last in, first out*—
        the most recently-added override has the highest priority.
        """

        if not isinstance(override, CostOverride):
            raise TypeError("override must be a CostOverride instance")
        self._overrides.append(override)

    def _lookup_override(self, provider: Optional[str], model_name: str) -> Optional[float]:
        """Return the cost from the highest-priority override that matches, or *None*."""

        for override in reversed(self._overrides):
            provider_matches = override.provider is None or override.provider == provider
            if provider_matches and override.pattern.fullmatch(model_name):
                return override.cost
        return None
