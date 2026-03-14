# GraphQL Patterns

Full templates and patterns for mutations, types, subscriptions, and input types.

## Adding a Mutation

### Step-by-step

1. Define an input type (or reuse an existing one)
2. Define a payload type
3. Write the mutation method in a mixin class
4. Register the mixin in `mutations/__init__.py`
5. Run `make graphql` to regenerate the schema

### Input Type Template

```python
from typing import Optional

import strawberry
from strawberry import UNSET

from phoenix.server.api.exceptions import BadRequest


@strawberry.input
class CreateThingInput:
    name: str
    description: Optional[str] = UNSET  # "not provided" vs "null"

    def __post_init__(self) -> None:
        if not self.name.strip():
            raise BadRequest("Name cannot be empty")
```

For patch/update inputs, include the target ID:

```python
@strawberry.input
class PatchThingInput:
    id: GlobalID
    name: Optional[str] = UNSET
    description: Optional[str] = UNSET
```

For union/oneOf inputs (pick exactly one variant):

```python
@strawberry.input(one_of=True)
class ThingConfigInput:
    variant_a: Optional[VariantAInput] = strawberry.UNSET
    variant_b: Optional[VariantBInput] = strawberry.UNSET
```

### Payload Type Template

Some payloads may include `query: Query` so the client can chain follow-up reads:

```python
from phoenix.server.api.queries import Query


@strawberry.type
class ThingMutationPayload:
    thing: Thing
    query: Query
```

For delete mutations, return `Query`. If the deleted entity is a GraphQL node, also return the deleted node ID. This enables the frontend to the `@deleteEdge` directive to update the Relay cache without refetching dataset from the server.

```python
@strawberry.type
class DeleteThingMutationPayload:
    id: GlobalID
    query: Query

async def delete_thing(self, ...) -> DeleteThingMutationPayload:
    # ... delete ...
    return DeleteThingMutationPayload(
        id=GlobalID("Thing", str(thing_id)),
        query=Query(),
    )
```

### Mutation Mixin Template

```python
import strawberry
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.queries import Query
from phoenix.server.dml_event import ThingInsertEvent


@strawberry.type
class ThingMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])
    async def create_thing(
        self,
        info: Info[Context, None],
        input: CreateThingInput,
    ) -> ThingMutationPayload:
        name = input.name.strip()
        description = input.description if input.description is not UNSET else None

        async with info.context.db() as session:
            thing = models.Thing(name=name, description=description)
            session.add(thing)

        # Emit DML event after the session commits
        info.context.event_queue.put(ThingInsertEvent((thing.id,)))

        return ThingMutationPayload(
            thing=to_gql_thing(thing),
            query=Query(),
        )
```

### Registering the Mixin

Add to `src/phoenix/server/api/mutations/__init__.py`:

```python
from phoenix.server.api.mutations.thing_mutations import ThingMutationMixin

@strawberry.type
class Mutation(
    ThingMutationMixin,
    # ... existing mixins ...
):
    pass
```

## Adding a GraphQL Type

### Type Template

```python
from typing import Optional

import strawberry
from strawberry.relay import Node, NodeID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context


@strawberry.type
class Thing(Node):
    id: NodeID[int]
    db_record: strawberry.Private[Optional[models.Thing]] = None

    def __post_init__(self) -> None:
        if self.db_record and self.id != self.db_record.id:
            raise ValueError("Thing ID mismatch")

    @strawberry.field
    async def name(self, info: Info[Context, None]) -> str:
        if self.db_record:
            return self.db_record.name
        return await info.context.data_loaders.thing_fields.load(
            (self.id, models.Thing.name),
        )

    @strawberry.field
    async def description(self, info: Info[Context, None]) -> Optional[str]:
        if self.db_record:
            return self.db_record.description
        return await info.context.data_loaders.thing_fields.load(
            (self.id, models.Thing.description),
        )
```

### Converter Function

Place near the type definition or in a helpers module:

```python
def to_gql_thing(thing: models.Thing) -> Thing:
    return Thing(id=thing.id, db_record=thing)
```

### Lazy Imports for Circular References

When type A references type B and vice versa, use `strawberry.lazy()`:

```python
from typing import TYPE_CHECKING, Annotated

import strawberry

if TYPE_CHECKING:
    from .OtherType import OtherType


@strawberry.field
async def related(self, info: Info[Context, None]) -> Annotated["OtherType", strawberry.lazy(".OtherType")]:
    from .OtherType import OtherType
    return OtherType(id=related_id)
```

### Polymorphic Types (Interface + Implementations)

When using `@strawberry.interface`, register all implementing types explicitly in the schema.
Check `schema.py` for the `_implementing_types()` helper that collects them.

## Subscription Pattern

Subscriptions are async generators with concurrency control:

```python
@strawberry.type
class Subscription:
    @strawberry.subscription(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])
    async def watch_thing(
        self,
        info: Info[Context, None],
        input: WatchThingInput,
    ) -> AsyncIterator[ThingPayload]:
        try:
            # Setup phase
            async with info.context.db() as session:
                # ... validate, fetch initial state ...
                pass

            # Streaming phase
            while has_more:
                yield ThingPayload(...)
        finally:
            # Cleanup: cancel tasks, close generators, release resources
            # Order matters — cancel first, then await, then close
            pass
```

Subscription cleanup order is critical: cancel tasks, await cancellation, close generators.
Getting this wrong causes resource leaks.

## Gotchas


**UNSET vs None** — `UNSET` means "the client didn't send this field." `None` means "the
client explicitly sent null." This distinction matters for patch mutations where you need to
differentiate "leave unchanged" from "clear the value."

**Lazy imports are required for circular type references** — Strawberry resolves types eagerly.
If type A has a field returning type B and type B has a field returning type A, both must use
`strawberry.lazy()` and `TYPE_CHECKING` guards.
