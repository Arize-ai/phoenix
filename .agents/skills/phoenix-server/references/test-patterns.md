# Test Patterns

Patterns for writing backend tests against the Phoenix GraphQL API.

## Running Tests

```bash
make test-python                              # full suite
uv run pytest path/to/test_file.py -n auto    # specific file, parallel
uv run pytest path/to/test_file.py -n auto -x # stop on first failure
uv run pytest path/to/test_file.py -xvs       # verbose, no capture (for debugging)
uv run pytest path/to/test_file.py --run-postgres  # also run against PostgreSQL
```

`-n auto` uses pytest-xdist to parallelize across CPU cores. Always use it unless you're
debugging a specific test and need sequential output.

## Key Fixtures

These come from `tests/unit/conftest.py` and `tests/unit/server/api/conftest.py`:

| Fixture | Type | What it gives you |
|---------|------|-------------------|
| `db` | `DbSessionFactory` | Async session factory — `async with db() as session:` |
| `gql_client` | `AsyncGraphQLClient` | Execute GraphQL operations over HTTP |
| `httpx_client` | `httpx.AsyncClient` | Raw HTTP client for REST endpoints |
| `dialect` | `str` | `"sqlite"` or `"postgresql"` — tests are parametrized across both |

The `db` fixture provides per-test transaction isolation. SQLite uses in-memory databases
with savepoint rollback; PostgreSQL uses template database cloning.

## Mutation Test Template

```python
import pytest
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


class TestCreateThing:
    _MUTATION = """
      mutation CreateThing($input: CreateThingInput!) {
        createThing(input: $input) {
          thing {
            id
            name
            description
          }
          query { __typename }
        }
      }
    """

    async def test_creates_thing(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
    ) -> None:
        # Execute mutation
        result = await gql_client.execute(
            self._MUTATION,
            variables={"input": {"name": "my-thing", "description": "desc"}},
        )

        # Assert GraphQL response
        assert result.data and not result.errors
        thing = result.data["createThing"]["thing"]
        assert thing["name"] == "my-thing"
        assert thing["description"] == "desc"

        # Verify database state
        thing_id = int(GlobalID.from_id(thing["id"]).node_id)
        async with db() as session:
            db_thing = await session.get(models.Thing, thing_id)
            assert db_thing is not None
            assert db_thing.name == "my-thing"
```

### Pattern Notes

**Always assert both `result.data` and `not result.errors`** — a response can have data
and errors simultaneously (partial success). Checking both catches subtle issues.

**Use a private `_MUTATION` class constant** for the GraphQL string. If a test class has
multiple tests against the same operation, they all share the string.

## Query Test Template

```python
async def test_lists_things(
    gql_client: AsyncGraphQLClient,
    some_fixture_that_creates_data: None,
) -> None:
    query = """
      query {
        things { edges { node { id name } } }
      }
    """
    result = await gql_client.execute(query=query)
    assert not result.errors
    assert len(result.data["things"]["edges"]) == 3
```

## GlobalID Construction and Parsing

```python
from strawberry.relay import GlobalID

# Construct: type name + string ID
gid = str(GlobalID("Dataset", str(dataset.id)))
# Result: base64-encoded relay ID like "RGF0YXNldDox"

# Parse: extract numeric ID from relay ID
node_id = int(GlobalID.from_id(relay_id_string).node_id)
```

## Data Setup Fixtures

Two patterns for setting up test data:

### Pattern 1: Direct ORM Inserts (most common)

```python
@pytest.fixture
async def thing_with_children(db: DbSessionFactory) -> models.Thing:
    async with db() as session:
        thing = models.Thing(name="parent")
        session.add(thing)
        await session.flush()  # flush to get the auto-generated ID

        child = models.Child(thing_id=thing.id, value="child-1")
        session.add(child)
        await session.flush()

    return thing
```

Use `await session.flush()` after `session.add()` when you need the auto-generated ID for
subsequent inserts. The session auto-commits when the `async with` block exits cleanly.

### Pattern 2: Complex fixture chains

Fixtures can depend on other fixtures for layered setup:

```
empty_dataset                          # base dataset + versions
  -> dataset_with_experiments          # adds experiments
    -> dataset_with_experiments_and_runs   # adds run data
```

Look at `tests/unit/server/api/conftest.py` for the full fixture chain — it has ready-made
fixtures for datasets, experiments, evaluators, and more.

## Subscription Test Pattern

```python
async def test_subscription(
    self,
    gql_client: AsyncGraphQLClient,
) -> None:
    async with gql_client.subscription(
        query=self._SUBSCRIPTION,
        variables={"input": {...}},
    ) as sub:
        async for data in sub.stream():
            typename = data["watchThing"]["__typename"]
            if typename == "TextChunk":
                assert data["watchThing"]["content"]
            elif typename == "SubscriptionResult":
                break
```

## Gotchas

**Fixture scope is per-test** — Each test gets a fresh database transaction that rolls back
after the test completes. Don't rely on data from a previous test.
