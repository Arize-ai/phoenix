# Test Patterns

Patterns for writing backend tests against the Phoenix GraphQL API.

## Running Tests

```bash
make test-python                              # full suite
uv run pytest path/to/test_file.py -n auto    # specific file, parallel
uv run pytest path/to/test_file.py -n auto -x # stop on first failure
uv run pytest path/to/test_file.py -xvs       # verbose, no capture (for debugging)
uv run pytest path/to/test_file.py --db postgresql # run against PostgreSQL instead
```

`--db postgresql` needs a PostgreSQL installation; pytest-postgresql finds `pg_ctl` through
`pg_config`, or takes `--postgresql-exec /path/to/pg_ctl`.

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

## Startup Shortcuts

The unit conftest cuts app startup short in every test. Some steps are memoized per xdist
worker, since each worker is its own process: key derivation, the GraphQL schema, the
routers, and FastAPI's route analysis. Others are stubbed out because no test observes them
except deliberately: the docs MCP session, the model-cost seeding, the WASM prefetch, the
`/mcp` mount, the Monty runtime probe, the agent MCP server, and the agent-session sweeper's
loop. Each worker's template database also carries the rows the app seeds at startup.
Worked examples on main: memoized computations in `7376f3fd5` (#15867), `e7faa374b` (#15876),
`515dd6b7b` (#15880), `c73b0d2ae` (#15878), and `64f6c60bc` (#15881); stubbed effects in
`5df03f271` (#15864), `1432884d1` (#15865), and `cfe1f883a` (#15866); template seeding in
`9c0aa95eb` (#15882).

A test whose subject is one of these behaviors opts out with the marker below; without it,
the test passes against the shortcut. The registrations in the unit conftest's
`pytest_configure` are the authoritative list.

| Marker | Use it when the test |
|--------|----------------------|
| `pristine_db` | seeds from an empty database, or counts rows in a table the app seeds |
| `seeded_model_costs` | needs the built-in models and their prices in the database |
| `real_docs_mcp_server` | exercises the docs MCP toolset |
| `real_agent_mcp_server` | exercises the agent's MCP server derived from the OpenAPI document |
| `real_monty_runtime_probe` | exercises the Monty runtime startup probe |
| `real_agent_session_sweeper` | needs the agent-session sweeper's loop to run |
| `real_key_derivation` | asserts on the PBKDF2 derivation itself |
| `real_graphql_schema_build` | inspects the schema object the app builds |
| `real_app_routers` | inspects the router objects the app builds |
| `real_fastapi_type_adapters` | inspects the pydantic adapters behind route fields |
| `real_fastapi_dependants` | inspects FastAPI's dependency analysis of routes |

The `/mcp` mount and the WASM prefetch have no marker; the tests that need them patch the
setting or call the function directly.

### Adding a startup shortcut

- **When.** A step qualifies when it runs during every app's construction or lifespan
  startup and shows in the setup phase of `--durations`. Work that runs per request, or that
  most tests assert on, does not qualify.
- **Memoize or stub.** A pure function of its inputs is memoized per worker, and every test
  keeps getting the real result: key derivation by secret, the schema by its extension list,
  a router by its builder's flag. A step whose result depends on anything else, such as
  environment flags read at construction, is left alone. A side effect no test observes,
  such as a network session or a seeding pass, is stubbed out, and every test whose subject
  is that effect opts out; a stub changes behavior, so its safety rests on the opt-outs.
- **Name the opt-out for the behavior the test needs**: `real_<thing>` for a replaced
  computation or effect, a data-state name such as `pristine_db` or `seeded_model_costs` for
  what the database holds. Put the marker on the tests whose subject is that behavior: the
  ones that assert on the object being built, the rows being seeded, or the session being
  opened. A test that only uses the result keeps the shortcut.
- **Patch through an autouse fixture that reads the marker** with
  `request.node.get_closest_marker`, returns early when it is present, and applies the patch
  with `monkeypatch` so it is undone per test. Register the marker in `pytest_configure`.
  Database-state markers are read by the engine fixtures instead.
- **Never let a cache keep an app alive.** Memoize only what recurs across apps, such as
  module-level functions and shared routers; a closure built per app is computed fresh.
  Hand out copies of anything the caller mutates afterwards (`64f6c60bc`, #15881).
- **Bound a cache whose keys can miss on every app in a normal run**, or it grows for the
  life of the worker (`c73b0d2ae`, #15878).
- **Pin the wiring with tests**: two apps in one worker share the object, the marker gives a
  fresh one, and a second app calls the real builder zero times. When the seam is a private
  attribute of a dependency, add a test that fails at the first setup if a release moves it
  (`c73b0d2ae`, #15878).

## Waiting on Daemons

Never `sleep` to give a daemon time to run. Give the test a controller: patch the daemon
class's sleep method with the controller's bound `park`, release the daemon once, and await
its return to the parked state. The model-store lifecycle test in `5df03f271` (#15864) and the
retention tests in #15893 do this.

```python
class _DaemonController:
    def __init__(self) -> None:
        self._release = Event()
        self._parked = Event()

    async def park(self, *_: Any, **__: Any) -> None:  # bound method, patched in for the sleep
        self._parked.set()
        await self._release.wait()
        self._release.clear()

    async def run_once(self, timeout: float = 30.0) -> None:
        await self._parked_within(timeout, "the daemon never parked")
        self._parked.clear()
        self._release.set()
        await self._parked_within(timeout, "the cycle did not finish")

    async def _parked_within(self, timeout: float, failure: str) -> None:
        try:
            await wait_for(self._parked.wait(), timeout)
        except asyncio.TimeoutError:
            pytest.fail(f"{failure} within {timeout:.0f}s")
```

Two details decide whether this works:

- **The patch must be in place before the app's lifespan starts the daemon**, or the daemon
  enters its real sleep and the first wait times out. pytest instantiates same-scope fixtures
  in the order the test requests them, so request the controller fixture before `asgi_app`,
  or make the fixture that starts the app depend on it.
- **Know whether the daemon works before it sleeps or after.** A daemon that sleeps first
  runs one cycle per release. A daemon that works first has finished a cycle by the time it
  first parks, so await that park on its own before releasing anything.

## Gotchas

**Fixture scope is per-test** — Each test gets a fresh database transaction that rolls back
after the test completes. Don't rely on data from a previous test.

**The database arrives seeded** — Unless the test carries `pristine_db`, roles, the system
user, the default retention policy, the builtin evaluators, and the sandbox providers are
present before the test starts (`9c0aa95eb`, #15882). Look a role up by name instead of
inserting it; the name is unique. A `pristine_db` test gets a schema-only database and seeds
what it needs.

**The client's pytest plugin is blocked** — `-p no:phoenix` in `pyproject.toml` keeps the
`arize-phoenix-client` plugin out of this suite (`d231b1754`, #15888). Its `phoenix` marker is
unregistered here: pytest warns about it and nothing records the test.
