# Span filter DSL testing

Tooling for exercising the span-filter DSL (`phoenix.trace.dsl.filter`) against
real databases.

The DSL's central promise is that a condition means the same thing on SQLite and
PostgreSQL, or is rejected on both. That cannot be checked by compiling — the
two backends disagree at *plan*, *bind*, and *row* time, none of which
compilation reaches. So the tooling here seeds identical data onto both and runs
conditions against each.

See `internal_docs/specs/span-filter-dsl.md` for the language itself.

## Seeding

```bash
# SQLite
uv run scripts/dsl-testing/span-filter/seed.py --url sqlite:///dsl.db

# PostgreSQL
uv run scripts/dsl-testing/span-filter/seed.py \
    --url postgresql://postgres:postgres@localhost:5433/postgres

# or take the URL from the environment
PHOENIX_SQL_DATABASE_URL=sqlite:///dsl.db uv run scripts/dsl-testing/span-filter/seed.py
```

Everything lands in a project named `dsl-corpus`. Re-running drops and rebuilds
only that project, so it is safe against a database holding other data, and safe
to run repeatedly.

A local PostgreSQL is available from the devops stack:

```bash
docker compose -f scripts/docker/devops/docker-compose.yml up -d db
```

## What is in the corpus

Ten spans and twenty annotations, none of them well-behaved. `corpus.py` records
why each row exists; the themes are:

| Hazard | Rows |
|---|---|
| JSON booleans in all three encodings (`true`, `"true"`, `1`) plus `null` | `flag` on every span |
| Text where a number is expected (`"abc"`, `"1_000"`, `"nan"`, `"inf"`, `" 12 "`) | `num` |
| Containers where a scalar is expected | `deep`, `arr`, `r` |
| Known-numeric attributes holding text | `llm.token_count.*` on `s08` |
| Multi-byte and quoted annotation names | `café`, `日本語`, `Q&A Correctness` |
| A name colliding with the generated alias prefix | `span_annotation_0` |
| Orphans — a parent pointer to a span that does not exist | `s03`, `s06` |
| Spans with no annotations at all | `bare01`, `bare02` |
| NULL scores and empty labels | `quality` on `s04`, `s08` |

Two properties are worth preserving if the corpus grows:

- **Nothing is dialect-specific.** Rows go through the ORM, so the same corpus
  describes both backends. A corpus that differed between them could not show
  whether the DSL agrees.
- **Every row breaks something.** A clean fixture never exercises a cast, and an
  empty one exercises nothing at all — a per-row failure cannot occur where
  there are no rows.

## Why the engine comes from Phoenix

`seed.py` builds its engine with `phoenix.db.engines.create_engine` rather than
SQLAlchemy directly. Phoenix's SQLite path uses `sqlean`, not the stdlib driver,
and some filters compile to SQLite functions (`text_contains`) that only
`sqlean` provides. A hand-rolled `create_engine("sqlite://")` yields a database
where valid conditions fail with `no such function: text_contains` — a
confusing result that says nothing about the DSL.

## Checking that the backends agree

Seed both, then run the same conditions against each and compare row counts. Any
difference — in what is accepted, or in what is returned — is a DSL defect, not
a database quirk to work around.

```python
from phoenix.trace.dsl.filter import SpanFilter

stmt = SpanFilter("attributes['flag'] == True")(select(models.Span.span_id))
```

Conditions worth including in any comparison, because each has produced a
divergence at some point: truthiness of a bare JSON attribute, numeric casts
over uncastable text, `is True` against all three boolean encodings,
`parent_span is None` versus `parent_id is None`, and any annotation name that
is not plain ASCII.
