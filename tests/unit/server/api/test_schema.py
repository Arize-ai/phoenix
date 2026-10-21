import asyncio
from typing import Optional

import strawberry

from phoenix.server.api.schema import (
    RetainFieldDetailsExecutionContext,
    build_graphql_schema,
    retain_field_details_lists,
)


@strawberry.type
class Item:
    id: strawberry.ID
    name: str
    extra: str


def _item() -> Item:
    return Item(id=strawberry.ID("1"), name="correctness", extra="DIST")


@strawberry.type
class Wrapper:
    item: Optional[Item]


@strawberry.type
class Query:
    @strawberry.field
    async def slow(self) -> Optional[Wrapper]:
        await asyncio.sleep(0.01)
        return Wrapper(item=_item())

    @strawberry.field
    async def fast(self) -> Optional[Item]:
        await asyncio.sleep(0.001)
        return _item()


class TestRetainFieldDetailsLists:
    async def test_sibling_root_fields_keep_their_own_selection_sets(self) -> None:
        """
        Regression test for https://github.com/graphql-python/graphql-core/issues/284:
        a nested field returning the same type as a faster sibling root field must
        not reuse the sibling's cached subfield selection.
        """
        schema = strawberry.Schema(query=Query)
        retain_field_details_lists(schema)
        query = "query { slow { item { id name } } fast { extra } }"
        for _ in range(20):
            result = await schema.execute(query)
            assert result.errors is None
            assert result.data == {
                "slow": {"item": {"id": "1", "name": "correctness"}},
                "fast": {"extra": "DIST"},
            }

    def test_is_idempotent(self) -> None:
        schema = strawberry.Schema(query=Query)
        retain_field_details_lists(schema)
        execution_context_class = schema.execution_context_class
        retain_field_details_lists(schema)
        assert schema.execution_context_class is execution_context_class

    def test_applied_by_build_graphql_schema(self) -> None:
        execution_context_class = build_graphql_schema().execution_context_class
        assert execution_context_class is not None
        assert issubclass(execution_context_class, RetainFieldDetailsExecutionContext)
