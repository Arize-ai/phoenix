# Feature rubric (starter - tune from real runs)

The session ends in exactly one of two states. Grade the criteria for the state it reached.

## State A: draft PR opened

1. The implementation follows the analyst's plan; any deviation is explained in the PR body.
2. New behavior is covered by tests that pass: server tests for API and DB changes, frontend tests or Storybook stories for new UI.
3. Schema changes ship a migration that works on SQLite and PostgreSQL, and every new mutation declares `permission_classes`.
4. Generated artifacts (GraphQL schema, Relay, OpenAPI clients) were regenerated with their `make` targets, not hand-edited.
5. Lint, format, typecheck and test `make` targets for every touched area were run and pass, with the commands shown in the session.
6. Every area the diff touches got a review pass, and each blocking finding is fixed or explained in the PR body.
7. User-visible behavior is documented under `docs/phoenix/`; changed `js/` packages have a changeset.
8. No file under `.github/`, `.claude/`, `.agents/`, nor any `AGENTS.md` or `CLAUDE.md`, is modified.
9. The PR is a draft against `main` from branch `factory/issue-<number>`, with a conventional-commit `feat` title, `Closes #<number>`, and the phoenix-pr-description template.

## State B: needs a decision

1. Each open question is specific and lists the options with their user-facing consequences.
2. No branch was pushed and no PR was opened.
3. One comment on the issue carries the questions.
