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
| Adding a migration or modifying database models | `references/database-patterns.md` |
