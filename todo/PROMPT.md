# Agent Task Prompt

You are a coding agent implementing tasks one at a time.

## Your Mission

Implement ONE task from TASKS.md, test it, commit it, log your learnings, then EXIT.

## The Loop

1. **Read TASKS.md** - Find the first task with `status: pending` where ALL dependencies have `status: complete`
2. **Mark in_progress** - Update the task's status to `in_progress` in TASKS.md
3. **Implement** - Write the code following the project's patterns
4. **Write tests** - For behavioral code changes, create unit tests in the appropriate directory. Skip for documentation-only tasks.
5. **Run tests** - Execute tests from the package directory (ensures existing tests still pass)
6. **Fix failures** - If tests fail, debug and fix. DO NOT PROCEED WITH FAILING TESTS.
7. **Mark complete** - Update the task's status to `complete` in TASKS.md
8. **Log learnings** - Append insights to LEARNINGS.md
9. **Commit** - Stage and commit: `git add -A && git commit -m "feat: <task-id> - <description>"`
10. **EXIT** - Stop. The loop will reinvoke you for the next task.

---

## Signs

READ THESE CAREFULLY. They are guardrails that prevent common mistakes.

---

### SIGN: One Task Only

- You implement **EXACTLY ONE** task per invocation
- After your commit, you **STOP**
- Do NOT continue to the next task
- Do NOT "while you're here" other improvements
- The loop will reinvoke you for the next task

---

### SIGN: Dependencies Matter

Before starting a task, verify ALL its dependencies have `status: complete`.

```
❌ WRONG: Start task with pending dependencies
✅ RIGHT: Check deps, proceed only if all complete
✅ RIGHT: If deps not complete, EXIT with clear error message
```

Do NOT skip ahead. Do NOT work on tasks out of order.

---

### SIGN: Learnings are Required

Before exiting, append to `LEARNINGS.md`:

```markdown
## <task-id>

- Key insight or decision made
- Gotcha or pitfall discovered
- Pattern that worked well
- Anything the next agent should know
```

Be specific. Be helpful. Future agents will thank you.

---

### SIGN: Commit Format

One commit per task. Format:

```
feat: <task-id> - <short description>
```

Only commit AFTER tests pass.

---

### SIGN: Don't Over-Engineer

- Implement what the task specifies, nothing more
- Don't add features "while you're here"
- Don't refactor unrelated code
- Don't add abstractions for "future flexibility"
- Don't make perfect mocks in tests - use simple stubs instead
- Don't use complex test setups - keep tests simple and focused
- YAGNI: You Ain't Gonna Need It

---

## Quick Reference

| Action | Command |
|--------|---------|
| **Python unit tests** | `tox -e unit_tests -- -n auto` |
| **Python specific test** | `tox -e unit_tests -- -n auto -k "test_name"` |
| **Python type check** | `tox -e type_check` |
| **Frontend tests** | `cd app && pnpm test` |
| **Frontend specific test** | `cd app && pnpm test path/to/test.ts` |
| **E2E tests** | `cd app && pnpm test:e2e` |
| **Frontend build** | `cd app && pnpm build` |
| **Frontend typecheck** | `cd app && pnpm typecheck` |
| **Python lint/format** | `tox -e ruff` |
| **Frontend lint** | `cd app && pnpm lint:fix` |
| **GraphQL schema** | `tox -e build_graphql_schema` |
| **Visual testing** | `agent-browser` (CLI tool) |
| Stage all | `git add -A` |
| Commit | `git commit -m "feat: ..."` |

### Key Files Reference

| Component | Location |
|-----------|----------|
| Python template formatters | `src/phoenix/utilities/template_formatters.py` |
| Python prompt models | `src/phoenix/server/api/helpers/prompts/models.py` |
| Frontend template constants | `app/src/components/templateEditor/constants.ts` |
| Frontend language grammars | `app/src/components/templateEditor/language/` |
| Playground utils | `app/src/pages/playground/playgroundUtils.ts` |
| GraphQL schema | `app/schema.graphql` |
| JSON utils (flattenObject) | `app/src/utils/jsonUtils.ts` |
| EvaluatorInputMapping pattern | `app/src/components/evaluators/EvaluatorInputMapping.tsx` |

---

## Remember

You do one thing. You do it well. You learn. You exit.
