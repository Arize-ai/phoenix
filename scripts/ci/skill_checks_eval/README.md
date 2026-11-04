# Skill example checks: evaluation

This folder measures whether the skill example checks in Arize-ai/phoenix#17589 catch the API
drift they exist to catch. Those checks are `test_skill_python_examples.py`,
`test_skill_typescript_examples.py` and `test_skill_px_commands.py`. The scripts import the
checks themselves, so every number below comes from the real fence parsing, fragment rules and
error filters, not from a reimplementation. None of the scripts makes a model call.

Measured on 2026-11-03 against `d34ca8d0f3`, the branch tip with the TypeScript check.

## Verdict

Keep the approach and change the fragment rules. Static type-checking against the workspace
packages is the right cheapest layer. It's fast, has no false flags under injected drift, and
catches every real drift case in history that it can see. As written, though, it checks only
about half of the Phoenix calls in the Python examples. Of the Python examples that a breaking
client change affects, it flags 35%. Most misses come from fragments that use `client`,
`register` or `LLM` without defining them. The rest come from two typing problems in
`phoenix.evals` that hide its API from pyright. Fixing both raises Python recall to 70% and
name coverage to 95%, with no new false flags. Almost all of the remaining misses are APIs
that take `**kwargs`, which no static check can see.

## How to run

Each script prints its table. The `px` and TypeScript scripts need `pnpm install` in `js/`
and the packages built, which `make check-skill-px-commands` and
`make check-skill-typescript-examples` do.

```bash
uv run python scripts/ci/skill_checks_eval/drift.py        # Python drift injection, about 3 min
uv run python scripts/ci/skill_checks_eval/coverage.py     # Python call-site coverage, about 30 s
uv run python scripts/ci/skill_checks_eval/px_drift.py     # px coverage and drift injection
uv run python scripts/ci/skill_checks_eval/ts_drift.py     # TypeScript drift injection
uv run python scripts/ci/skill_checks_eval/history.py      # Replay of real drift from git history
```

`ts_drift.py` edits the built `.d.ts` files in `js/packages/phoenix-*/dist` in place and
restores them afterwards. A copy doesn't work, because `phoenix-client` links `phoenix-otel` and
`phoenix-evals` through the workspace, and tsc picks one copy of each package by name and
version.

## Design

| Script | Question | Ground truth |
| --- | --- | --- |
| `drift.py` | When a client, evals or otel API breaks, does the check fail the examples that use it? | An AST oracle per mutation, such as "calls `run_experiment` with `experiment_name=`" |
| `coverage.py` | What share of Phoenix call sites does the check see at all? | Per call site, rename the called name, or add a bogus keyword, and see whether the check notices |
| `px_drift.py` | Does the `px` check find every command and catch removed subcommands and flags? | Literal token match against the command tree |
| `ts_drift.py` | The same as `drift.py`, for TypeScript, on a smaller sample | A regex oracle per mutation |
| `history.py` | Would the check have caught the real drift in git history? | The commit that fixed each skill |

`drift.py` and `coverage.py` also run three variants of the Python check, to show what each
proposed change buys:

- `+typed-evals` guards `phoenix.evals.__getattr__` with `if not TYPE_CHECKING`, and types the
  evals deprecation decorators so they keep the wrapped signature.
- `+prelude` gives undefined Phoenix names their real types before pyright runs. See
  `prelude.py`.
- `+both` applies both changes.

A subagent searched all 116 commits that touch the skills to find the history cases. Only three
are real drift: an example that worked, broke when the API changed, and was then fixed. The
other broken examples were wrong when they were written. The full list is in the shared notes
for this project, in `drift-history-cases.md`.

## Results

### Python drift injection: 19 mutations, 130 affected examples

| Variant | Recall | Mutations fully caught | Wrong flags |
| --- | --- | --- | --- |
| check (#17589) | 46/130 = 35% | 1 of 17 | 0 |
| +typed-evals | 70/130 = 54% | 5 of 17 | 0 |
| +prelude | 67/130 = 52% | 9 of 17 | 0 |
| +both | 91/130 = 70% | 13 of 17 | 0 |

Two mutations have no affected examples, so the table counts 17. The script reports 2 to 4
"spurious" flags per variant. I read each one, and none is a wrong flag. They're oracle gaps:
for example, renaming `evaluators=` also breaks `evaluate_experiment` and `resume_experiment`,
which the oracle doesn't list. Others are examples that were already broken and gained another
error.

Under `+both`, 37 of the 39 remaining misses are keyword arguments to functions with
`**kwargs`. These are `register` (`otel.py:76`), `LLM` (`llm/llm.py:133`) and the optional
arguments of `ClassificationEvaluator` (`evaluators.py:715`). Pyright accepts any keyword for
these functions.

### Python call-site coverage: 174 Phoenix call sites

| Variant | Name checked | Arguments checked |
| --- | --- | --- |
| check (#17589) | 83 (48%) | 71 (41%) |
| +typed-evals | 124 (71%) | 87 (50%) |
| +prelude | 120 (69%) | 99 (57%) |
| +both | 165 (95%) | 115 (66%) |

### Baseline flags each Python variant adds

| Variant | New flags | Real bugs | Wrong flags |
| --- | --- | --- | --- |
| +typed-evals | 1 | 0 | 1, caused by a client typing bug |
| +both | 4 | 2 | 2, caused by the same client typing bug |

The two real bugs aren't in `KNOWN_BROKEN`:

- `skills/phoenix-evals/references/experiments-datasets-python.md:67` calls
  `get_dataset(name=...)`.
- `skills/phoenix-evals/references/experiments-running-python.md:65` reads
  `experiment.aggregate_scores`, and the same block also reads `.runs`.

The wrong flags come from `EvalsEvaluator` in
`packages/phoenix-client/src/phoenix/client/resources/experiments/types.py:113`. That protocol
no longer matches `phoenix.evals.Evaluator`, so passing a `ClassificationEvaluator` to
`run_experiment(evaluators=...)` fails type-checking even though it works at runtime. The fix
belongs in the client, not in the skills.

An early version of the prelude also typed `client` and `llm` everywhere. That produced 10
wrong flags, because some tracing skills use `client` for an OpenAI client and `llm` for a
LangChain model. The version in `prelude.py` types `client` only when the block reads a Phoenix
resource such as `client.spans`, and leaves `llm` alone.

### px

- Extraction: the check finds 180 of the 182 lines that mention a `px` command. The other two
  are inside ```ts fences.
- Depth: 188 of the 190 commands it extracts are checked through their flags. The other two
  stop at a placeholder.
- Drift injection: 186 mutations remove one subcommand or flag at a time. Recall is 560/572 =
  98%. Five misses are hidden by the `KNOWN_BROKEN` entry for `px trace list --profile`. The
  other seven are `px docs fetch`, which a pass-through parent hides from the check.

### TypeScript: 8 mutations, 77 affected examples

Recall is 56/77 = 73%, with no wrong flags. Of the 21 misses, 20 are fragments that call
`register` or `getSpans` without importing them. The last one is hidden by a `KNOWN_BROKEN`
entry. The five "spurious" flags are again oracle gaps: making `labels` required on the shared
classification type also breaks the prebuilt evaluator factories.

### History replay

| Case | Result |
| --- | --- |
| `px` noun-verb rename (`a195055d03`) | 17 of the 24 changed commands flagged, with no wrong flags. After the fix, 0 of 41 are flagged. With a stricter placeholder rule, 23 of 24 are flagged. |
| `phoenix.otel.suppress_tracing` exported late (`23576da85d`) | 1/1 flagged against the old otel; 0/1 against the new one |
| `phoenix.experiments` removed (`9ce9e1859d`) | 1/1 flagged before the fix; 0 after it |

The 7 noun-verb misses are commands such as `px trace <trace-id>`. The placeholder rule
(`test_skill_px_commands.py:144`) stops checking at any `<...>` token in a subcommand position,
so it accepts a positional argument where `px trace` needs a subcommand. If the rule stops only
at subcommand placeholders such as `<command>` and `<resource>`, 6 of the 7 are caught. That
rule flags nothing new in the current skills.

### Precision on today's flags

Of the 15 `KNOWN_BROKEN` entries (6 Python, 2 `px`, 7 TypeScript), 11 are real API errors. The
other four are code that runs or is only notation:

- The bodyless signature in `instrumentation-atif-python.md`.
- The `log_spans` list, which pyright infers as `list[dict]` instead of `list[Span]`.
- The TypeScript `test.each` case name, a strict-mode complaint.
- The TypeScript `groupBy`, typed `unknown` only because the fragment's own `getSpans` is
  undefined.

### Alternatives

- **Run the examples against a live Phoenix.** 100 of the 148 Python blocks use names they
  never define, so only 48 can run without rewriting. Most of those also need a server and LLM
  keys, which means model spend. Running examples also wouldn't catch the `**kwargs` misses
  unless the forwarded call rejects the keyword. It's a poor fit for the cheapest layer.
- **Generate examples from tested code.** The repo already does this for docs
  (`make sync-docs-snippets`). It's worth it for a few flagship blocks, but not for about 260
  fragments, because every block would become a file to maintain.
- **A lighter import-existence check.** This catches only function renames, which are 33 of
  the 130 affected examples, and nothing about arguments. It's strictly weaker than the
  prelude, which costs about as much code.

## Why this stays on a branch

The mutations are regular expressions pinned to today's signatures, such as
`def get_dataset(\s*self,\s*\*,\s*)dataset`. They break as soon as the code they target
changes. These scripts are a one-time measurement, so keeping them working in CI would cost
more than they return. If the prelude lands in the check, rerun `coverage.py` from this
branch to confirm the gain.
