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


class ModelSpec(NamedTuple):
    provider: Optional[str]
    model: str


class ModelCostLookup:
    __slots__ = ("_provider_model_map", "_model_map")

    def __init__(self):
        # Each provider maps to a *RegexDict* of (pattern -> cost).
        self._provider_model_map = defaultdict(RegexDict)
        # Map from *pattern string* to a set of providers that have that pattern.
        self._model_map = defaultdict(set)

    def __setitem__(self, key: ModelSpec, value: float):
        provider, pattern = key.provider, key.model
        self._provider_model_map[provider][pattern] = value
        self._model_map[pattern].add(provider)

    def __delitem__(self, key: ModelSpec):
        provider, pattern = key.provider, key.model
        del self._provider_model_map[provider][pattern]
        self._model_map[pattern].discard(provider)
        if not self._provider_model_map[provider]:
            del self._provider_model_map[provider]
        if not self._model_map[pattern]:
            del self._model_map[pattern]

    def __getitem__(self, key: ModelSpec):
        provider, model_name = key.provider, key.model

        if provider is None:
            # Return a list of (provider, cost) pairs whose *patterns* match the
            # requested model string.
            matches = []
            for p, regex_dict in self._provider_model_map.items():
                try:
                    cost = regex_dict[model_name]
                except KeyError:
                    continue
                matches.append((p, cost))
            if not matches:
                raise KeyError(model_name)
            return matches

        regex_dict = self._provider_model_map.get(provider)
        if regex_dict is None:
            raise KeyError(provider)
        return regex_dict[model_name]

    def __contains__(self, key: ModelSpec):
        provider, model_name = key.provider, key.model

        if provider is None:
            # Does *any* provider have a pattern matching this model string?
            return any(model_name in regex_dict for regex_dict in self._provider_model_map.values())

        regex_dict = self._provider_model_map.get(provider)
        if not regex_dict:
            return False
        return model_name in regex_dict

    def __len__(self):
        return sum(len(regex_dict) for regex_dict in self._provider_model_map.values())
