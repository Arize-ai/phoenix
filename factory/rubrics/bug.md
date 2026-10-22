# Bug fix rubric (starter - tune from real runs)

The session ends in exactly one of two states. Grade the criteria for the state it reached, from the PR and the session transcript.

## State A: draft PR opened

1. The transcript shows a test added in this PR failing for the reason the issue reports before the fix, and passing after it.
2. The diff is confined to the bug's path and stays under 400 changed lines, not counting generated files and lockfiles; no unrelated refactors, formatting churn, or comments that narrate the change.
3. The format, lint and typecheck targets for every touched area, and the tests next to the changed code, ran and passed in the transcript.
4. Every area the diff touches (server, frontend, packages) got a review pass. Each blocking finding is fixed or, if disputed, listed in the PR body.
5. No file under `.github/`, `.cursor/`, `.claude/`, `.agents/`, `factory/` or `plugins/`, nor any `AGENTS.md` or `CLAUDE.md`, is modified.
6. Changed `js/packages/` packages have a changeset; no `pyproject.toml` gains a pre-release production dependency.
7. The PR is a draft against `main` from branch `factory/issue-<number>`, with a conventional-commit `fix` title.
8. The PR body follows the phoenix-pr-description template: it starts with `resolves #<number>`, its Verified line names the commands that ran, and its Not verified line names what the sandbox couldn't run.

## State B: not reproduced

1. The reproducer's attempts are concrete: the tests or commands that were run, and their output.
2. No branch was pushed and no PR was opened.
3. One comment on the issue states what was tried and what specific information would let someone reproduce it.
