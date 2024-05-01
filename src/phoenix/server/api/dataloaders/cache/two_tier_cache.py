from abc import ABC
from asyncio import Future
from typing import Any, Callable, Generic, Optional, Tuple, TypeVar, cast

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
        if main_cache_factory:
            cls._main_cache_factory = staticmethod(main_cache_factory)
        if sub_cache_factory:
            cls._sub_cache_factory = staticmethod(sub_cache_factory)

    def _cache_keys(self, key: _Key) -> Tuple[_Section, _SubKey]:
        return cast(Tuple[_Section, _SubKey], key)

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
