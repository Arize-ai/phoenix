# Feature rubric (starter - tune from real runs)

The session ends in exactly one of two states. Grade the criteria for the state it reached, from the PR and the session transcript.

## State A: draft PR opened

1. The implementation follows the analyst's plan and covers its first slice only; any deviation is explained in the PR body, and the remaining slices are listed as follow-ups.
2. The diff stays under 400 changed lines, not counting generated files and lockfiles, and adds no options, parameters or abstractions the issue doesn't need.
3. New behavior is covered by tests that ran and passed in the transcript: server tests for API and DB changes, frontend tests or Storybook stories for new UI.
4. Schema changes ship a migration that works on SQLite and PostgreSQL, and every new mutation declares `permission_classes`.
5. Generated artifacts (GraphQL schema, Relay, OpenAPI clients) were regenerated with their `make` targets in the transcript, not hand-edited.
6. The format, lint and typecheck targets for every touched area ran and passed in the transcript.
7. Every area the diff touches got a review pass. Each blocking finding is fixed or, if disputed, listed in the PR body.
8. User-visible behavior is documented under `docs/phoenix/`; changed `js/packages/` packages have a changeset.
9. No file under `.github/`, `.cursor/`, `.claude/`, `.agents/`, `factory/` or `plugins/`, nor any `AGENTS.md` or `CLAUDE.md`, is modified.
10. The PR is a draft against `main` from branch `factory/issue-<number>`, with a conventional-commit `feat` title.
11. The PR body follows the phoenix-pr-description template: it starts with `resolves #<number>`, its Verified line names the commands that ran, and its Not verified line names what the sandbox couldn't run.

## State B: needs a decision

1. Each open question is specific and lists the options with their user-facing consequences.
2. No branch was pushed and no PR was opened.
3. One comment on the issue carries the questions.
