---
name: phoenix-server
user-invocable: false
description: >
  Backend development guide for the Phoenix AI observability platform (Strawberry GraphQL,
  SQLAlchemy async, FastAPI). Use this skill when writing or modifying Python server code
  in the phoenix repo — adding mutations, types, migrations, or tests. Trigger on any
  backend task touching src/phoenix/server/, src/phoenix/db/, or tests/unit/server/.
metadata:
  internal: true
---

# Phoenix Backend Development

Phoenix is an AI observability platform. The backend is Python: FastAPI serving a REST API and Strawberry
GraphQL API over an async SQLAlchemy ORM (PostgreSQL + SQLite).

## Development Guide Index

Read `DEVELOPMENT.md` (env setup, `uv`, tests, debugpy, pre-commit, REST API conventions) and `CONTRIBUTING.md` (PR format, conventional commits, code review expectations) if you have not already.

### Everyday Commands

```bash
make dev-backend                        # backend only, no frontend build needed
uv run pytest path/to/test -n auto      # run specific tests in parallel
make test-python                        # full test suite
make graphql                            # regenerate schema after GQL changes
make format                             # format all code
make typecheck-python                   # mypy + pyright
```

## Key Directories

```
src/phoenix/server/api/
  mutations/        Domain-specific mutation mixins, composed in __init__.py
  types/            GraphQL types with field resolvers
  input_types/      Strawberry @input classes with validation
  subscriptions.py  Async generator subscriptions (streaming)
  queries.py        Root query type
  context.py        Request context: db, dataloaders, auth, event queue
  dataloaders/      Batch loaders (prevent N+1 queries)
  auth.py           Permission classes (IsNotReadOnly, IsNotViewer, etc.)
  routers/          REST API endpoints (v1/)
src/phoenix/db/
  models.py         SQLAlchemy ORM models (single file)
  migrations/       Alembic migrations
tests/unit/server/api/
  mutations/        Mutation tests
  types/            Type resolver tests
  conftest.py       Fixtures: db, gql_client, test data factories
```

## What Are You Doing?

| Task | Reference |
|------|-----------|
| Adding or modifying a mutation, type, subscription, or input | `references/graphql-patterns.md` |
| Writing or modifying tests | `references/test-patterns.md` |
| Writing tests for code that emits OpenInference spans (VCR cassettes, span attribute assertions) | `references/llm-trace-tests.md` |
| Adding a migration or modifying database models | `references/database-patterns.md` |

## Hard Rules

- **Side effects belong on `Mutation`, not `Query`.** A resolver that makes outbound
  network calls, reads secrets, writes state, or accepts a user-supplied URL/host
  MUST be a `@strawberry.mutation` with `permission_classes=[...]`. Query fields
  bypass the `make check-graphql-permissions` CI guard and are reachable
  unauthenticated by default — this has been exploited as an SSRF vector. See
  `references/graphql-patterns.md` → "Query vs Mutation".

## Naming

- **Name new mutations after the HTTP verb they are synonymous with**:
  `createThing`, `patchThing`, `setThing`, `deleteThing` — not `applyThingChanges`
  or `updateThing`. `patch` covers any partial write to existing resources,
  including a collection-level write that also adds and removes members in one
  transaction. The input type takes the same name (`PatchThingInput`). Existing
  `update*` mutations and `addXToY` linking mutations are not covered by this.
  See `references/graphql-patterns.md` → "Naming: use the HTTP verb".
- **Avoid acronyms and single/double-letter abbreviations for local variables.**
  Prefer the full noun: `session` / `project_session` over `ps`, `trace` over `t`,
  `example` / `dataset_example` over `de`. The cost of a longer identifier is trivial; the
  cost of having to mentally expand an acronym while reading unfamiliar code is
  not.
- Established domain acronyms used in the codebase (`db`, `gql`, `otel`, `llm`)
  are fine — they're vocabulary, not abbreviations of local nouns.

## Docstrings

The project rule of "default to no comments" is about **inline comments**, not
docstrings. Public APIs should be documented.

- **Document parameters and return values on public methods of reusable classes**
  (clients, services, factories, builders). Use Google-style `Args:` / `Returns:`
  /  `Raises:` blocks when the meaning isn't fully recoverable from the type
  signature. Do not strip these during refactors — semantics outlive file moves.
- **Describe behavior, not implementation.** A method on a docs-search client
  says "Invoke a backend tool and return its text result", not "Invoke a tool
  on the MCP server" — the underlying transport is an implementation detail and
  the docstring should survive a transport swap. Internal helpers (leading `_`)
  may reference the transport directly since their scope is bounded.
- **One-liner docstrings are fine** when the name and types fully convey intent
  (`close()`, `is_backend_tool(name)`). Don't pad them with restated signatures.
- **Module docstrings** belong at the top of any file that exposes public
  surface (a client class, a router, a service module). One sentence on what
  the module is for is enough.
