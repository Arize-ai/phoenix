# GraphQL Patterns

Full templates and patterns for mutations, types, subscriptions, and input types.

## Query vs Mutation: Side Effects MUST Be Mutations

A GraphQL field belongs on `Mutation` (not `Query`) if it does any of the following:

- Makes outbound HTTP, gRPC, or other network calls to user-controlled or
  user-influenced destinations (URLs, hostnames, headers, kwargs)
- Calls a "test connection" / "validate credentials" / "ping" style operation
- Writes to the database, the filesystem, or an external store
- Reads or decrypts secrets
- Triggers a side effect that costs money, time, or external rate limits

**Why this matters:** `Query` fields are conventionally treated as safe, cacheable
reads. They are easy to forget on the auth path, they are reachable through
introspection, and `permission_classes` are far less commonly applied to query
resolvers than to mutations. A query resolver that issues HTTP requests with a
user-supplied `base_url` is an unauthenticated SSRF vector — this has happened
in this codebase (`testGenerativeModelCustomProviderCredentials` was originally
a query and was used to reach internal cloud metadata endpoints).

If you find yourself writing a `@strawberry.field` on `Query` that takes a URL,
a config object, credentials, or anything that ends up making a network call:
**stop and make it a mutation** with `permission_classes=[...]`. The CI guard
`make check-graphql-permissions` enforces that all mutations and subscriptions
declare permission classes; queries get no such guarantee.

When in doubt, ask: "could an unauthenticated attacker who can reach `/graphql`
abuse this field to do something they should not?" If the answer is anything
other than a confident no, it must be a mutation behind auth.

## Adding a Mutation

### Naming: use the HTTP verb

Name a **new** mutation `<verb><Resource>`, where the verb is the HTTP method it
is synonymous with. Name the input type to match: `patchDatasetExamples` takes
`PatchDatasetExamplesInput`.

| Verb | HTTP | Use for |
| --- | --- | --- |
| `create` | `POST` | Bringing a new resource into existence |
| `patch` | `PATCH` | Any partial write to existing resources |
| `set` | `PUT` | Replacing a value or membership set wholesale (idempotent) |
| `delete` | `DELETE` | Removing a resource |

`patch` covers a collection-level write that also adds and removes members in one
transaction — that is still an HTTP `PATCH` on the collection, so
`patchDatasetExamples` takes additions, patches, and deletions together rather
than splitting into three mutations. Reach for `set` only when the write replaces
the whole thing and re-sending it is a no-op (`setDatasetLabels`,
`setPromptVersionTag`).

Prefer the verb over a bespoke name that describes the implementation:

| Instead of | Use |
| --- | --- |
| `applyDatasetExampleChanges` | `patchDatasetExamples` |
| `updateThing`, `editThing`, `modifyThing` | `patchThing` |
| `removeThing` | `deleteThing` |
| `newThing` | `createThing` |

Two shapes this rule does **not** reach:

- **Linking a resource into a parent collection** — `addSpansToDataset`,
  `addExamplesToDataset`, `addAnnotationConfigToProject`. `addXToY` is the right
  name; it is not CRUD on `X` itself.
- **Mutations that already ship.** `updateModel`, `updateAnnotationConfig` and
  friends predate this convention and are part of the public schema. Follow the
  convention for new mutations; do not rename existing ones without a deliberate
  migration.

A verb-named mutation is a stable place to grow. When a write needs to do more
(add deletions to a patch mutation, say), widen the existing input rather than
adding a second mutation beside it — two mutations that write the same resource
force callers to choose, and the narrower one rots.

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
