from __future__ import annotations

from abc import ABC, abstractmethod
from asyncio import gather
from inspect import getmro
from itertools import chain
from typing import (
    Any,
    Callable,
    Generic,
    Iterable,
    Iterator,
    Mapping,
    Optional,
    Set,
    Tuple,
    Type,
    TypedDict,
    TypeVar,
    Union,
    cast,
)

from sqlalchemy import Select, select
from typing_extensions import TypeAlias, Unpack

from phoenix.db.models import (
    Base,
    DocumentAnnotation,
    Project,
    Span,
    SpanAnnotation,
    Trace,
    TraceAnnotation,
)
from phoenix.server.api.dataloaders import CacheForDataLoaders
from phoenix.server.dml_event import (
    DmlEvent,
    DocumentAnnotationDmlEvent,
    SpanAnnotationDmlEvent,
    SpanDeleteEvent,
    SpanDmlEvent,
    TraceAnnotationDmlEvent,
)
from phoenix.server.types import (
    BatchedCaller,
    CanSetLastUpdatedAt,
    DbSessionFactory,
)

_DmlEventT = TypeVar("_DmlEventT", bound=DmlEvent)


class _DmlEventQueue(Generic[_DmlEventT]):
    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._events: Set[_DmlEventT] = set()

    @property
    def empty(self) -> bool:
        return not self._events

    def put(self, event: _DmlEventT) -> None:
        self._events.add(event)

    def clear(self) -> None:
        self._events.clear()

    def __iter__(self) -> Iterator[_DmlEventT]:
        yield from self._events


class _HandlerParams(TypedDict):
    db: DbSessionFactory
    last_updated_at: CanSetLastUpdatedAt
    cache_for_dataloaders: Optional[CacheForDataLoaders]
    sleep_seconds: float


class _HasLastUpdatedAt(ABC):
    def __init__(
        self,
        last_updated_at: CanSetLastUpdatedAt,
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        self._last_updated_at = last_updated_at


class _HasCacheForDataLoaders(ABC):
    def __init__(
        self,
        cache_for_dataloaders: Optional[CacheForDataLoaders] = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        self._cache_for_dataloaders = cache_for_dataloaders


class _DmlEventHandler(
    _HasLastUpdatedAt,
    _HasCacheForDataLoaders,
    BatchedCaller[_DmlEventT],
    Generic[_DmlEventT],
    ABC,
):
    _batch_factory = cast(Callable[[], _DmlEventQueue[_DmlEventT]], _DmlEventQueue)

    def __init__(self, *, db: DbSessionFactory, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._db = db

    def __hash__(self) -> int:
        return id(self)


class _GenericDmlEventHandler(_DmlEventHandler[DmlEvent]):
    async def __call__(self) -> None:
        for e in self._batch:
            for id_ in e.ids:
                self._update(e.table, id_)

    def _update(self, table: Type[Base], id_: int) -> None:
        self._last_updated_at.set(table, id_)


class _SpanDmlEventHandler(_DmlEventHandler[SpanDmlEvent]):
    async def __call__(self) -> None:
        if cache := self._cache_for_dataloaders:
            for id_ in set(chain.from_iterable(e.ids for e in self._batch)):
                self._clear(cache, id_)

    @staticmethod
    def _clear(cache: CacheForDataLoaders, project_id: int) -> None:
        cache.latency_ms_quantile.invalidate(project_id)
        cache.token_count.invalidate(project_id)
        cache.record_count.invalidate(project_id)
        cache.min_start_or_max_end_time.invalidate(project_id)


class _SpanDeleteEventHandler(_SpanDmlEventHandler):
    @staticmethod
    def _clear(cache: CacheForDataLoaders, project_id: int) -> None:
        cache.annotation_summary.invalidate_project(project_id)
        cache.document_evaluation_summary.invalidate_project(project_id)


_AnnotationTable: TypeAlias = Union[
    Type[SpanAnnotation],
    Type[TraceAnnotation],
    Type[DocumentAnnotation],
]

_AnnotationDmlEventT = TypeVar(
    "_AnnotationDmlEventT",
    SpanAnnotationDmlEvent,
    TraceAnnotationDmlEvent,
    DocumentAnnotationDmlEvent,
)


class _AnnotationDmlEventHandler(
    _DmlEventHandler[_AnnotationDmlEventT],
    Generic[_AnnotationDmlEventT],
    ABC,
):
    _table: _AnnotationTable
    _base_stmt: Union[Select[Tuple[int, str]], Select[Tuple[int]]] = (
        select(Project.id).join_from(Project, Trace).distinct()
    )

    def __init__(self, **kwargs: Unpack[_HandlerParams]) -> None:
        super().__init__(**kwargs)
        self._stmt = self._base_stmt
        if self._cache_for_dataloaders:
            self._stmt = self._stmt.add_columns(self._table.name)

    def _get_stmt(self) -> Union[Select[Tuple[int, str]], Select[Tuple[int]]]:
        ids = set(chain.from_iterable(e.ids for e in self._batch))
        return self._stmt.where(self._table.id.in_(ids))

    @staticmethod
    @abstractmethod
    def _clear(cache: CacheForDataLoaders, project_id: int, name: str) -> None: ...

    async def __call__(self) -> None:
        async with self._db() as session:
            async for row in await session.stream(self._get_stmt()):
                self._last_updated_at.set(Project, row.id)
                if cache := self._cache_for_dataloaders:
                    self._clear(cache, row.id, row.name)


class _SpanAnnotationDmlEventHandler(_AnnotationDmlEventHandler[SpanAnnotationDmlEvent]):
    _table = SpanAnnotation

    def __init__(self, **kwargs: Unpack[_HandlerParams]) -> None:
        super().__init__(**kwargs)
        self._stmt = self._stmt.join_from(Trace, Span).join_from(Span, self._table)

    @staticmethod
    def _clear(cache: CacheForDataLoaders, project_id: int, name: str) -> None:
        cache.annotation_summary.invalidate((project_id, name, "span"))


class _TraceAnnotationDmlEventHandler(_AnnotationDmlEventHandler[TraceAnnotationDmlEvent]):
    _table = TraceAnnotation

    def __init__(self, **kwargs: Unpack[_HandlerParams]) -> None:
        super().__init__(**kwargs)
        self._stmt = self._stmt.join_from(Trace, self._table)

    @staticmethod
    def _clear(cache: CacheForDataLoaders, project_id: int, name: str) -> None:
        cache.annotation_summary.invalidate((project_id, name, "trace"))


class _DocumentAnnotationDmlEventHandler(_AnnotationDmlEventHandler[DocumentAnnotationDmlEvent]):
    _table = DocumentAnnotation

    def __init__(self, **kwargs: Unpack[_HandlerParams]) -> None:
        super().__init__(**kwargs)
        self._stmt = self._stmt.join_from(Trace, Span).join_from(Span, self._table)

    @staticmethod
    def _clear(cache: CacheForDataLoaders, project_id: int, name: str) -> None:
        cache.document_evaluation_summary.invalidate((project_id, name))


class DmlEventHandler:
    def __init__(
        self,
        *,
        db: DbSessionFactory,
        last_updated_at: CanSetLastUpdatedAt,
        cache_for_dataloaders: Optional[CacheForDataLoaders] = None,
        sleep_seconds: float = 0.1,
    ) -> None:
        kwargs = _HandlerParams(
            db=db,
            last_updated_at=last_updated_at,
            cache_for_dataloaders=cache_for_dataloaders,
            sleep_seconds=sleep_seconds,
        )
        self._handlers: Mapping[Type[DmlEvent], Iterable[_DmlEventHandler[Any]]] = {
            DmlEvent: [_GenericDmlEventHandler(**kwargs)],
            SpanDmlEvent: [_SpanDmlEventHandler(**kwargs)],
            SpanDeleteEvent: [_SpanDeleteEventHandler(**kwargs)],
            SpanAnnotationDmlEvent: [_SpanAnnotationDmlEventHandler(**kwargs)],
            TraceAnnotationDmlEvent: [_TraceAnnotationDmlEventHandler(**kwargs)],
            DocumentAnnotationDmlEvent: [_DocumentAnnotationDmlEventHandler(**kwargs)],
        }
        self._all_handlers = frozenset(chain.from_iterable(self._handlers.values()))

    async def __aenter__(self) -> None:
        await gather(*(h.start() for h in self._all_handlers))

    async def __aexit__(self, *args: Any, **kwargs: Any) -> None:
        await gather(*(h.stop() for h in self._all_handlers))

    def put(self, event: DmlEvent) -> None:
        if not (isinstance(event, DmlEvent) and event):
            return
        for cls in getmro(type(event)):
            if not (issubclass(cls, DmlEvent) and (handlers := self._handlers.get(cls))):
                continue
            for h in handlers:
                h.put(event)
            if cls is DmlEvent:
                break
