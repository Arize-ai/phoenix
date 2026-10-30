# Bug fix rubric (starter - tune from real runs)

The session ends in exactly one of two states. Grade the criteria for the state it reached, from the PR and the session transcript.

## State A: draft PR opened

1. Either the transcript shows a test added in this PR failing for the reason the issue reports before the fix and passing after it, or the reproducer reported `NEEDS_BROWSER` with file:line evidence of the cause and the PR body's Not verified line lists the steps that would show the bug.
2. Every test added in this PR exercises real code at the lowest layer that shows the behavior, and would fail if the fix were reverted. None hand-writes a fake GraphQL or REST server, fakes layout or scroll metrics, mocks the module under test, or silences warnings so fake payloads pass.
3. The diff is confined to the bug's path; no unrelated refactors, formatting churn, or comments that narrate the change.
4. The format, lint and typecheck targets for every touched area, and the tests next to the changed code, ran and passed in the transcript.
5. Every area the diff touches (server, frontend, packages) got a review pass, shown by the reviewer's final report quoted in the transcript. Each blocking finding is fixed or, if disputed, listed in the PR body.
6. No file under `.github/`, `.cursor/`, `.claude/`, `.agents/`, `factory/` or `plugins/`, nor any `AGENTS.md` or `CLAUDE.md`, is modified.
7. Changed `js/packages/` packages have a changeset; no `pyproject.toml` gains a pre-release production dependency.
8. The PR is a draft against `main` from branch `factory/issue-<number>`, with a conventional-commit `fix` title.
9. The PR body starts with `resolves #<number>`, its Verified line names the commands that ran, and its Not verified line names what the sandbox couldn't run.
10. Exactly one assessment comment on the PR follows `factory/assessment.md`, matches the PR's final state, and takes its risk ratings from the reviewers' risk lines.

## State B: not reproduced

1. The reproducer's attempts are concrete: the tests or commands that were run, and their output.
2. No branch was pushed and no PR was opened.
3. One comment on the issue states what was tried and what specific information would let someone reproduce it.
