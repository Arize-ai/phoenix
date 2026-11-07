# Feature rubric (starter - tune from real runs)

The session ends in exactly one of two states. Grade the criteria for the state it reached, from the PR and the session transcript.

## State A: draft PR opened

1. The analyst's first report includes one acceptance test, driving the entry point the issue describes (a REST or GraphQL request, an OTLP export, a `px` command, a client call, or an `agent-browser` run) against a Phoenix server it started, or, for code that never reaches a server, by calling the package's public API from the working tree, before the change, with the behavior absent in its output; a `px` command or TypeScript client call ran the working-tree build, not the published package.
2. Called back after the implementation, the analyst reran the same acceptance test unchanged against the implemented tree and reported the behavior present. The builder did not run, edit or substitute for the acceptance test itself, and the PR body's Acceptance test section quotes both outputs from the analyst's reports. Or the analyst's report says what stopped the server or the acceptance test from running in the sandbox, and the PR body's Not verified line repeats it.
3. The implementation follows the analyst's plan and covers its first slice only; any deviation is explained in the PR body, and the remaining slices are listed as follow-ups.
4. The diff adds no options, parameters or abstractions the issue doesn't need.
5. New behavior is covered by tests that ran and passed in the transcript: server tests for API and DB changes, frontend tests or Storybook stories for new UI. Each test exercises real code and would fail if the behavior were removed; none hand-writes a fake GraphQL or REST server, fakes layout or scroll metrics, mocks the module under test, or silences warnings so fake payloads pass. Behavior that only a browser shows is covered by the acceptance test when it drove the UI, and is listed on the PR body's Not verified line otherwise.
6. Schema changes ship a migration that works on SQLite and PostgreSQL, and every new mutation declares `permission_classes`.
7. Generated artifacts (GraphQL schema, Relay, OpenAPI clients) were regenerated with their `make` targets in the transcript, not hand-edited.
8. The format, lint and typecheck targets for every touched area ran and passed in the transcript.
9. Every area the diff touches got a review pass, shown by the reviewer's final report quoted in the transcript. Each blocking finding is fixed or, if disputed, listed in the PR body.
10. User-visible behavior is documented under `docs/phoenix/`; changed `js/packages/` packages have a changeset.
11. No file under `.github/`, `.cursor/`, `.claude/`, `.agents/`, `factory/` or `plugins/`, nor any `AGENTS.md` or `CLAUDE.md`, is modified.
12. The PR is a draft against `main` from branch `factory/issue-<number>`, with a conventional-commit `feat` title.
13. The PR body starts with `resolves #<number>`, its Acceptance test section matches the acceptance test runs in the transcript, its Verified line names the commands that ran, and its Not verified line names what the sandbox couldn't run.
14. Exactly one assessment comment on the PR follows `factory/assessment.md`, matches the PR's final state, and takes its risk ratings from the reviewers' risk lines.

## State B: needs a decision

1. Each open question is specific and lists the options with their user-facing consequences.
2. No branch was pushed and no PR was opened.
3. One comment on the issue carries the questions.
