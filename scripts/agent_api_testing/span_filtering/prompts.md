# Agent Trial Prompts — Attribute Filter Usability

Seven realistic agent-facing task prompts for the Phase 2 trial (plan:
`_work/agent-usability-testing-attribute-filter-param/plan.md`). Each prompt
has an explicit ground-truth expected match set derived from the seed data
in `seed.py` (`SEED_SPANS` / `EXPECTED_MATCHES`), so trial evaluation in
`trial-results.md` is objective.

## Trial conventions

- Project: `agent-trial-attribute-filter` (created by `seed.py`).
- Endpoint under test: `GET {base_url}/v1/projects/agent-trial-attribute-filter/spans`.
- Each trial hands the agent ONLY: (a) `schemas/openapi.json`, (b) the
  prompt text below, (c) the Phoenix `base_url`. No hints about the
  `attribute` filter's type-aware semantics, smart-quoting, or silent
  failure modes.
- The expected match set below is derived from the seed manifest. It is
  the ground truth for "did the agent construct a working filter URL?";
  do NOT show it to the agent.
- If an agent returns zero rows, the harness records that outcome
  verbatim — it does NOT tell the agent whether zero rows is correct.

## Prompt P1 — plain string user.id (baseline)

> **Prompt to agent:** "Find all spans in the `agent-trial-attribute-filter`
> project where the user id is `user-42`. Return the URL you would call
> and the row count returned."

- **Shape exercised:** plain string `user.id`.
- **Expected match set:** `{span-user-string}` (1 span).
- **Outcome classification keys:**
  - `valid-first-try` — URL `?attribute=user.id:user-42` (or
    URL-encoded equivalent) returns exactly `span-user-string`.
  - `semantic-miss` — returns zero rows or wrong rows despite 200.
  - `syntactic-error` — 4xx from a malformed filter.

## Prompt P2 — numeric-looking string user.id (type-coercion footgun)

> **Prompt to agent:** "Find all spans in the `agent-trial-attribute-filter`
> project where the user id is `12345`. Return the URL you would call
> and the row count returned."

- **Shape exercised:** `user.id` stored as the *string* `"12345"`; this is
  the forced-string-quoting escape hatch (`user.id:"12345"` vs
  `user.id:12345`).
- **Expected match set:** `{span-user-string-numeric}` (1 span).
- **The footgun:** if the agent emits bare `attribute=user.id:12345`,
  server-side dispatch parses the value as the integer `12345` and
  compares `CAST(col AS TEXT) == '12345'`, which does not match the
  stored JSON string `"12345"` (CAST yields `'"12345"'`, with quotes).
  Zero rows. The correct URL requires
  `attribute=user.id:"12345"` (URL-encoded: `user.id:%2212345%22`).
- **Outcome classification keys:**
  - `valid-first-try` — agent quoted the numeric string, 1 row.
  - `type-coercion-footgun-hit` — agent emitted bare numeric, 0 rows.
  - `self-correction-success` — agent saw 0 rows and retried with quotes.
  - `self-correction-fail` — agent gave up or concluded "no such user".

## Prompt P3 — session.id with internal colons

> **Prompt to agent:** "Find all spans in the `agent-trial-attribute-filter`
> project belonging to session `sess:abc:123`. Return the URL you would
> call and the row count returned."

- **Shape exercised:** `session.id` value containing colons;
  `_parse_attribute` uses `split(":", 1)` so the whole suffix is the
  value.
- **Expected match set:** `{span-session-colon}` (1 span).
- **Outcome classification keys:**
  - `valid-first-try` — URL-encoded
    `?attribute=session.id:sess:abc:123` returns 1 row.
  - `colon-in-value-handled` — agent recognized that the value contains
    colons and did NOT try to pre-escape or re-quote them.
  - `over-escaping` — agent wrapped the value in quotes unnecessarily
    (which on `session.id` is fine because the value is a non-numeric
    non-boolean string, but records whether the agent over-engineered).

## Prompt P4 — nested metadata path

> **Prompt to agent:** "Find all spans in the `agent-trial-attribute-filter`
> project whose metadata tier is `premium`. Return the URL you would call
> and the row count returned."

- **Shape exercised:** nested-object path `metadata.tier` —
  `attributes[['metadata','tier']]` generates dot-path JSON access on
  both SQLite and PostgreSQL.
- **Expected match set:** `{span-metadata-nested}` (1 span).
- **Outcome classification keys:**
  - `valid-first-try` — `?attribute=metadata.tier:premium` returns 1
    row.
  - `nested-path-misconstruction` — agent used JSONPath, brackets, or
    some other nesting syntax instead of dot notation.

## Prompt P5 — list-valued `tag.tags` (silent zero rows footgun)

> **Prompt to agent:** "Find all spans in the `agent-trial-attribute-filter`
> project tagged with `prod`. The project uses standard OpenInference
> `tag.tags` attributes. Return the URL you would call and the row count
> returned."

- **Shape exercised:** `tag.tags` is stored as a LIST (`["prod",
  "experimental"]`). The filter does not "contains" a list; it compares
  `CAST(col AS TEXT) == json.dumps(value)`, so `tag.tags:"prod"`
  compares `'["prod","experimental"]'` to `'"prod"'` — never matches.
  Silent zero rows, 200 OK. This is the explicit footgun from plan D3.
- **Expected match set:** `{}` (EMPTY — known silent-zero-rows case).
  The seed span `span-tag-list` exists but CANNOT be retrieved via the
  `attribute` filter. This is intentional: the trial measures whether
  the agent recognizes the semantic miss vs concluding the tag is
  absent.
- **Outcome classification keys:**
  - `silent-zero-rows-recognized` — agent saw 0 rows and suspected the
    list-valued attribute isn't filterable (stated in response).
  - `silent-zero-rows-accepted-as-truth` — agent concluded no such
    span exists (the dangerous outcome).
  - `self-correction-attempt` — agent tried variants (e.g.,
    `tag.tags.0:prod`, `tag.tags:prod`, `tag.tags:["prod"]` → 422
    because list values are rejected) before reporting.

## Prompt P6 — ISO-8601 timestamp value

> **Prompt to agent:** "Find all spans in the `agent-trial-attribute-filter`
> project where `metadata.start_time` is `2026-04-16T10:30:00Z`. Return
> the URL you would call and the row count returned."

- **Shape exercised:** a value that looks like a timestamp string and
  contains multiple colons; exercises both colon-in-value and type
  dispatch (json.loads raises → fallback to raw string → CAST equality
  against the json.dumps'd string).
- **Expected match set:** `{span-iso-timestamp}` (1 span).
- **Outcome classification keys:**
  - `valid-first-try` — URL-encoded
    `?attribute=metadata.start_time:2026-04-16T10:30:00Z` returns 1
    row.
  - `colon-in-value-handled` — agent did NOT split the value on
    colons itself.
  - `over-quoting` — agent quoted the ISO string unnecessarily; this
    should still work (`CAST(col, Text) == '"2026-04-16T10:30:00Z"'`
    matches the stored JSON string).

## Prompt P7 — compound multi-filter (AND-across-params)

> **Prompt to agent:** "Find all spans in the `agent-trial-attribute-filter`
> project for user `user-42` in session `sess:abc:123` where the
> metadata tier is `premium`. Return the URL you would call and the row
> count returned."

- **Shape exercised:** AND-across-params semantics. The agent must
  repeat the `attribute` query parameter three times. No single seeded
  span satisfies all three conditions simultaneously (by design — the
  compound prompt is expected to return an empty set).
- **Expected match set:** `{}` (EMPTY — by seed-set construction).
- **Outcome classification keys:**
  - `and-across-params-recognized` — agent emitted three `attribute=...`
    params in one URL.
  - `or-within-param-confused` — agent tried comma-separated values,
    OR-concatenation, or some other single-param encoding.
  - `empty-result-recognized-correctly` — agent returned 0 rows AND
    reported "no span matches all three criteria" (NOT "the endpoint is
    broken").

## Prompt P8 (stretch — optional OR-within-param probe)

If trial time allows, this probes the OR-within-param semantics that
distinguish multi-value single-param from AND-across-params:

> **Prompt to agent:** "Find all spans in the `agent-trial-attribute-filter`
> project whose metadata tier is either `premium` or `enterprise`.
> Return the URL you would call and the row count returned."

- **Shape exercised:** if the agent repeats `attribute=metadata.tier:...`
  for BOTH values, the query applies OR-within-the-same-key; there's
  only one tier=premium span in the seed so the expected match is 1.
- **Expected match set:** `{span-metadata-nested}` (1 span).
- **Outcome classification keys:**
  - `or-within-param-recognized` — agent emitted two `attribute=` params
    for the same key and got 1 row.
  - `or-within-param-unused` — agent made two separate requests.
  - `and-across-params-misapplied` — agent tried to union the results
    server-side.

Prompts P1-P7 are the required set; P8 is optional but useful for
distinguishing OR-within-param from AND-across-params when trial time
permits.
