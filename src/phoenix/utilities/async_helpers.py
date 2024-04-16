from typing import AsyncIterable, TypeVar

GenericType = TypeVar("GenericType")


async def achain(*aiterables: AsyncIterable[GenericType]) -> AsyncIterable[GenericType]:
    """
    Chains together multiple async iterables into a single async iterable. The
    async analogue of itertools.chain.
    """
    for aiterable in aiterables:
        async for value in aiterable:
            yield value
