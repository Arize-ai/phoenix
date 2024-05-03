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

from cachetools import Cache, LFUCache
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
    _main_cache_factory: "staticmethod[[], Cache[_Section, Cache[_SubKey, Future[_Result]]]]" = (
        staticmethod(lambda: LFUCache(maxsize=32))
    )
    _sub_cache_factory: "staticmethod[[], Cache[_SubKey, Future[_Result]]]" = staticmethod(
        lambda: LFUCache(maxsize=8)
    )

    def __init_subclass__(
        cls,
        *,
        main_cache_factory: Optional[
            Callable[[], "Cache[_Section, Cache[_SubKey, Future[_Result]]]"]
        ] = None,
        sub_cache_factory: Optional[Callable[[], "Cache[_SubKey, Future[_Result]]"]] = None,
        **kwargs: Any,
    ) -> None:
        super().__init_subclass__(**kwargs)
        # There are three different places we can have thees factories defined: 1. at each runtime
        # instantiation of the cache, 2. at each subclass definition of the cache, and 3. only
        # here at the super-class. 1 is superfluous because we're not going to have more than one
        # instance of the cache, much less two instances of the cache with different factories.
        # 3 is too restrictive because each subclass might want to dictate its own eviction policy.
        # So we go with 2, with the added benefit that the factories can be located in proximity
        # to the cache subclass's corresponding DataLoder class.
        if main_cache_factory:
            cls._main_cache_factory = staticmethod(main_cache_factory)
        if sub_cache_factory:
            cls._sub_cache_factory = staticmethod(sub_cache_factory)

    @abstractmethod
    def _cache_keys(self, key: _Key) -> Tuple[_Section, _SubKey]: ...

    def invalidate(self, section: _Section) -> None:
        if sub_cache := self._cache.get(section):
            sub_cache.clear()

    def __init__(self) -> None:
        self._cache = self._main_cache_factory()

    def get(self, key: _Key) -> Optional["Future[_Result]"]:
        section, sub_key = self._cache_keys(key)
        if not (sub_cache := self._cache.get(section)):
            return None
        return sub_cache.get(sub_key)

    def set(self, key: _Key, value: "Future[_Result]") -> None:
        section, sub_key = self._cache_keys(key)
        if (sub_cache := self._cache.get(section)) is None:
            self._cache[section] = sub_cache = self._sub_cache_factory()
        sub_cache[sub_key] = value

    def delete(self, key: _Key) -> None:
        section, sub_key = self._cache_keys(key)
        if sub_cache := self._cache.get(section):
            del sub_cache[sub_key]
            if not sub_cache:
                del self._cache[section]

    def clear(self) -> None:
        self._cache.clear()
