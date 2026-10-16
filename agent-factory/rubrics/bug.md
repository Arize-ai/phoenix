# Bug fix rubric (starter - tune from real runs)

The session ends in exactly one of two states. Grade the criteria for the state it reached.

## State A: draft PR opened

1. A test added in this PR fails on `main` and passes on the PR branch, and it exercises the behavior the issue reports.
2. The fix is confined to code on the bug's path; unrelated refactors and formatting churn are absent from the diff.
3. Lint, format, typecheck and test `make` targets for every touched area were run and pass, with the commands shown in the session.
4. Every area the diff touches (server, frontend, packages) got a review pass, and each blocking finding is fixed or explained in the PR body.
5. No file under `.github/`, `.claude/`, `.agents/`, nor any `AGENTS.md` or `CLAUDE.md`, is modified.
6. Changed `js/` packages have a changeset; no `pyproject.toml` gains a pre-release production dependency.
7. The PR is a draft against `main` from branch `factory/issue-<number>`, with a conventional-commit `fix` title and `Fixes #<number>` in the body.
8. The PR body follows the phoenix-pr-description template, including the "How this PR was made" section.

## State B: not reproduced

1. The reproducer's attempts are concrete: the tests or commands that were run, and their output.
2. No branch was pushed and no PR was opened.
3. One comment on the issue states what was tried and what specific information would let someone reproduce it.
