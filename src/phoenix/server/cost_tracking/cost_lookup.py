from collections import defaultdict
from typing import NamedTuple, Optional


class ModelSpec(NamedTuple):
    provider: Optional[str]
    model: str


class ModelCostLookup:
    __slots__ = ("_provider_model_map", "_model_map")

    def __init__(self):
        self._provider_model_map = defaultdict(dict)
        self._model_map = defaultdict(set)
        self._cost_overlays = []

    def __setitem__(self, key: ModelSpec, value: float):
        provider, model = key.provider, key.model
        self._provider_model_map[provider][model] = value
        self._model_map[model].add(provider)

    def __delitem__(self, key: ModelSpec):
        provider, model = key.provider, key.model
        del self._provider_model_map[provider][model]
        self._model_map[model].discard((provider, model))
        if not self._provider_model_map[provider]:
            del self._provider_model_map[provider]
        if not self._model_map[model]:
            del self._model_map[model]

    def __getitem__(self, key: ModelSpec):
        provider, model = key.provider, key.model
        if provider is None:
            return [(p, self._provider_model_map[p][model]) for p in self._model_map.get(model, ())]
        return self._provider_model_map[provider][model]

    def __contains__(self, key: ModelSpec):
        provider, model = key.provider, key.model
        if provider is None:
            return self._model_map.get(model)
        provider_models = self._provider_model_map.get(provider)
        return provider_models and model in provider_models

    def __len__(self):
        return sum(len(model) for model in self._provider_model_map.values())
