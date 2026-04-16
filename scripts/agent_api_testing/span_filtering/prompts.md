# Agent Trial Prompts — Attribute Filter Usability

Seven realistic task prompts (P1–P7) plus one optional stretch prompt (P8).
Each prompt pairs an agent-facing task with a ground-truth expected match
set and classification keys used for manual scoring of transcripts.

## Conventions

- Project: `agent-trial-attribute-filter` (created by `seed.py`).
- Endpoint: `GET {base_url}/v1/projects/agent-trial-attribute-filter/spans`.
- Agent is given only `schemas/openapi.json`, the prompt text, and the
  Phoenix `base_url`. No hints about filter semantics or quoting.
- Rubrics below each prompt are for scoring only — never show to the agent.

## P1 — plain string user.id

> Find all spans in the `agent-trial-attribute-filter` project where the
> user id is `user-42`. Return the URL you would call and the row count
> returned.

- Expected: `{span-user-string}` (1 span).
- Keys: `valid-first-try` | `semantic-miss` | `syntactic-error`.

## P2 — numeric-looking string user.id (type-coercion footgun)

> Find all spans in the `agent-trial-attribute-filter` project where the
> user id is `12345`. Return the URL you would call and the row count
> returned.

- Correct: `attribute=user.id:"12345"` (URL-encoded: `user.id:%2212345%22`).
  Bare `user.id:12345` is parsed as int and silently returns zero rows.
- Expected: `{span-user-string-numeric}` (1 span).
- Keys: `valid-first-try` | `type-coercion-footgun-hit` | `self-correction-success` | `self-correction-fail`.

## P3 — session.id with internal colons

> Find all spans in the `agent-trial-attribute-filter` project belonging
> to session `sess:abc:123`. Return the URL you would call and the row
> count returned.

- The filter splits on the first `:`, so the whole suffix is the value.
- Expected: `{span-session-colon}` (1 span).
- Keys: `valid-first-try` | `colon-in-value-handled` | `over-escaping`.

## P4 — nested metadata path

> Find all spans in the `agent-trial-attribute-filter` project whose
> metadata tier is `premium`. Return the URL you would call and the row
> count returned.

- Expected: `{span-metadata-nested}` (1 span).
- Keys: `valid-first-try` | `nested-path-misconstruction`.

## P5 — list-valued `tag.tags` (silent zero rows footgun)

> Find all spans in the `agent-trial-attribute-filter` project tagged
> with `prod`. The project uses standard OpenInference `tag.tags`
> attributes. Return the URL you would call and the row count returned.

- `tag.tags` is stored as a list; filter does equality, not containment.
  No valid `attribute=tag.tags:...` exists; every query returns 200 + 0 rows.
- Expected: `{}` (EMPTY — measures whether the agent recognizes the
  semantic miss vs concluding the tag is absent).
- Keys: `silent-zero-rows-recognized` | `silent-zero-rows-accepted-as-truth` | `self-correction-attempt`.

## P6 — ISO-8601 timestamp value

> Find all spans in the `agent-trial-attribute-filter` project where
> `metadata.start_time` is `2026-04-16T10:30:00Z`. Return the URL you
> would call and the row count returned.

- Exercises colon-in-value handling on a timestamp-shaped string.
- Expected: `{span-iso-timestamp}` (1 span).
- Keys: `valid-first-try` | `colon-in-value-handled` | `over-quoting`.

## P7 — compound multi-filter (AND-across-params)

> Find all spans in the `agent-trial-attribute-filter` project for user
> `user-42` in session `sess:abc:123` where the metadata tier is
> `premium`. Return the URL you would call and the row count returned.

- Requires three repeated `attribute=` params; by seed construction no
  span satisfies all three.
- Expected: `{}` (EMPTY).
- Keys: `and-across-params-recognized` | `or-within-param-confused` | `empty-result-recognized-correctly`.

## P8 — OR-within-param probe (optional stretch)

> Find all spans in the `agent-trial-attribute-filter` project whose
> metadata tier is either `premium` or `enterprise`. Return the URL you
> would call and the row count returned.

- Repeating `attribute=metadata.tier:...` for both values ORs within
  the same key; only `premium` matches in the seed.
- Expected: `{span-metadata-nested}` (1 span).
- Keys: `or-within-param-recognized` | `or-within-param-unused` | `and-across-params-misapplied`.
