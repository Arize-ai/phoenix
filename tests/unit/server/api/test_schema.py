import asyncio
from typing import Optional

import strawberry


@strawberry.type
class Item:
    id: strawberry.ID
    name: str
    extra: str


_ITEM = Item(id=strawberry.ID("1"), name="correctness", extra="DIST")


@strawberry.type
class Wrapper:
    pad: Optional[str] = None
    item: Optional[Item] = None


_WRAPPER = Wrapper(pad="x", item=_ITEM)


@strawberry.type
class Query:
    @strawberry.field
    async def slow(self) -> Optional[Wrapper]:
        await asyncio.sleep(0.01)
        return _WRAPPER

    @strawberry.field
    async def fast(self) -> Optional[Item]:
        await asyncio.sleep(0.001)
        return _ITEM


async def test_sibling_root_fields_keep_their_own_selection_sets() -> None:
    """
    Regression test for https://github.com/graphql-python/graphql-core/issues/284:
    a nested field returning the same type as a faster sibling root field must
    not reuse the sibling's cached subfield selection.
    """
    schema = strawberry.Schema(query=Query)
    query = "query { slow { pad item { id name } } fast { extra } }"
    for _ in range(20):
        result = await schema.execute(query)
        assert result.errors is None
        assert result.data == {
            "slow": {"pad": "x", "item": {"id": "1", "name": "correctness"}},
            "fast": {"extra": "DIST"},
        }
