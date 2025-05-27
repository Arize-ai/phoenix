import json
import os
import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterator, Optional, Union


@dataclass
class ModelTokenCost:
    # Cost in USD
    input: Optional[float] = None
    output: Optional[float] = None
    cache_write: Optional[float] = None
    cache_read: Optional[float] = None
    audio: Optional[float] = None


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


def create_cost_table(
    manifest_path: Optional[Union[str, "os.PathLike[str]"]] = None,
) -> "ModelCostLookup":
    if manifest_path is None:
        manifest_path = Path(__file__).with_name("model_cost_manifest.json")

    manifest_path = Path(manifest_path)

    if not manifest_path.exists():
        raise FileNotFoundError(f"Model cost manifest not found: {manifest_path}")

    with manifest_path.open("r", encoding="utf-8") as fp:
        try:
            manifest_entries: list[dict[str, Any]] = json.load(fp)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Failed to parse manifest JSON: {manifest_path}") from exc

    lookup = ModelCostLookup()

    for entry in manifest_entries:
        provider: Optional[str] = entry.get("provider")

        try:
            pattern = re.compile(entry["regex"])
        except re.error as exc:
            raise ValueError(
                f"Invalid regex in manifest for model {entry.get('model')}: {entry['regex']}"
            ) from exc

        cost = ModelTokenCost(
            input=entry.get("input"),
            output=entry.get("output"),
            cache_write=entry.get("cache_write"),
            cache_read=entry.get("cache_read"),
        )

        lookup.add_pattern(provider, pattern, cost)

    return lookup


COST_TABLE = create_cost_table()
