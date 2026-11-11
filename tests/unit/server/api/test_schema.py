import asyncio
import re
from typing import Optional

import strawberry
from graphql import GraphQLEnumType, GraphQLObjectType

from phoenix.server.api.schema import build_graphql_schema


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


def test_the_evaluation_reporting_types_use_the_words_users_see() -> None:
    """The types that report on evaluation never name the pipeline that does the work."""
    reporting_prefixes = (
        "EvaluationQueue",
        "ProjectEvaluationQueue",
        "EvaluationActivity",
        "ProjectEvaluatorRunSummary",
        "ProjectEvaluatorRunStatus",
        "ProjectEvaluatorEvaluationLoad",
    )
    type_map = build_graphql_schema()._schema.type_map
    reporting_types = [
        named_type for name, named_type in type_map.items() if name.startswith(reporting_prefixes)
    ]
    assert all(
        any(named_type.name.startswith(prefix) for named_type in reporting_types)
        for prefix in reporting_prefixes
    )

    texts: list[str] = []
    for named_type in reporting_types:
        texts += [named_type.name, named_type.description or ""]
        if isinstance(named_type, GraphQLObjectType):
            for field_name, field in named_type.fields.items():
                texts += [field_name, field.description or ""]
                for argument_name, argument in field.args.items():
                    texts += [argument_name, argument.description or ""]
        elif isinstance(named_type, GraphQLEnumType):
            for value_name, value in named_type.values.items():
                texts += [value_name, value.description or ""]
    words = [re.sub(r"(?<=[a-z])(?=[A-Z])", " ", text).lower() for text in texts]
    leaked = [
        (term, text)
        for term in ("sweep", "scan", "work unit", "frontier", "cursor")
        for text in words
        if term in text
    ]
    assert leaked == []
