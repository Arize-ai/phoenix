"""
The primary intent of a two-tier system is to make cache invalidation more efficient,
because the cache keys are typically tuples such as (project_id, time_interval, ...),
but we need to invalidate subsets of keys, e.g. all those associated with a
specific project, very frequently (i.e. essentially at each span insertion). In a
single-tier system we would need to check all the keys to see if they are in the
subset that we want to invalidate.
"""

from abc import ABC, abstractmethod
from asyncio import Future
from typing import Any, Callable, Generic, Optional, Tuple, TypeVar

from cachetools import Cache
from strawberry.dataloader import AbstractCache

_Key = TypeVar("_Key")
_Result = TypeVar("_Result")

_Section = TypeVar("_Section")
_SubKey = TypeVar("_SubKey")


class TwoTierCache(
    AbstractCache[_Key, _Result],
    Generic[_Key, _Result, _Section, _SubKey],
    ABC,
):
    def __init__(
        self,
        main_cache: "Cache[_Section, Cache[_SubKey, Future[_Result]]]",
        sub_cache_factory: Callable[[], "Cache[_SubKey, Future[_Result]]"],
        *args: Any,
        **kwargs: Any,
    ) -> None:
        super().__init__(*args, **kwargs)
        self._cache = main_cache
        self._sub_cache_factory = sub_cache_factory

    @abstractmethod
    def _cache_key(self, key: _Key) -> Tuple[_Section, _SubKey]: ...

    def invalidate(self, section: _Section) -> None:
        if sub_cache := self._cache.get(section):
            sub_cache.clear()

    def get(self, key: _Key) -> Optional["Future[_Result]"]:
        section, sub_key = self._cache_key(key)
        if not (sub_cache := self._cache.get(section)):
            return None
        return sub_cache.get(sub_key)

    def set(self, key: _Key, value: "Future[_Result]") -> None:
        section, sub_key = self._cache_key(key)
        if (sub_cache := self._cache.get(section)) is None:
            self._cache[section] = sub_cache = self._sub_cache_factory()
        sub_cache[sub_key] = value

    def delete(self, key: _Key) -> None:
        section, sub_key = self._cache_key(key)
        if sub_cache := self._cache.get(section):
            del sub_cache[sub_key]
            if not sub_cache:
                del self._cache[section]

    def clear(self) -> None:
        self._cache.clear()
