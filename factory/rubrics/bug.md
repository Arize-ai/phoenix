# Bug fix rubric (starter - tune from real runs)

The session ends in exactly one of two states. Grade the criteria for the state it reached, from the PR and the session transcript.

## State A: draft PR opened

1. The reproducer's first report gives the cause as file:line evidence and, where the code allows a unit test, shows a test added in this PR failing for the reason the issue reports before the fix; its verify report shows that test passing on the fixed tree. Where it wrote no test, it says why only a running server or browser shows the bug.
2. The reproducer ran one acceptance test, driving the entry point the issue describes (an OTLP export, a REST or GraphQL request, a `px` command, a client call, or an `agent-browser` run) against a Phoenix server it started, or, for code that never reaches a server, by calling the package's public API from the working tree; a `px` command or TypeScript client call ran the working-tree build, not the published package. It ran once before the fix with the issue's symptom in its output, and once, called back after the fix, on the fixed tree without it, with the acceptance test unchanged between runs. The fixer did not run, edit or substitute for the acceptance test itself, and the PR body's Acceptance test section quotes both outputs from the reproducer's reports. Or the reproducer's report says what stopped the server or the acceptance test from running in the sandbox, and the PR body's Not verified line repeats it.
3. Every test added in this PR exercises real code at the lowest layer that shows the behavior, and would fail if the fix were reverted. None hand-writes a fake GraphQL or REST server, fakes layout or scroll metrics, mocks the module under test, or silences warnings so fake payloads pass.
4. The diff is confined to the bug's path; no unrelated refactors, formatting churn, or comments that narrate the change.
5. The format, lint and typecheck targets for every touched area, and the tests next to the changed code, ran and passed in the transcript.
6. Every area the diff touches (server, frontend, packages) got a review pass, shown by the reviewer's final report quoted in the transcript. Each blocking finding is fixed or, if disputed, listed in the PR body.
7. No file under `.github/`, `.cursor/`, `.claude/`, `.agents/`, `factory/` or `plugins/`, nor any `AGENTS.md` or `CLAUDE.md`, is modified.
8. Changed `js/packages/` packages have a changeset; no `pyproject.toml` gains a pre-release production dependency.
9. The PR is a draft against `main` from branch `factory/issue-<number>`, with a conventional-commit `fix` title.
10. The PR body's Preview seed section holds one self-contained ```python block that sends data showing the fix to the server at `PHOENIX_BASE_URL` and prints where to look, using only the standard library and the packages the server image ships, and the transcript shows it ran to exit 0 against a server on the fixed tree.
11. The PR body starts with `resolves #<number>`, its Acceptance test section matches the acceptance test runs in the transcript, its Verified line names the commands that ran, and its Not verified line names what the sandbox couldn't run.
12. Exactly one assessment comment on the PR follows `factory/assessment.md`, matches the PR's final state, and takes its risk ratings from the reviewers' risk lines.

## State B: not reproduced

1. The reproducer's attempts are concrete: the tests or commands that were run, and their output.
2. No branch was pushed and no PR was opened.
3. One comment on the issue states what was tried and what specific information would let someone reproduce it.
