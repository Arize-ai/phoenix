# Docs rubric (starter - tune from real runs)

Grade from the PR and the session transcript.

1. The change addresses the gap the issue describes, and nothing broader.
2. Every parameter, default, command and code sample matches the current source; the transcript shows the code that was read to confirm it.
3. Every code block the PR adds or changes was run from a temporary script, or type-checked when it can't run, and the transcript shows each command and its result. A block that was not run says why in the PR body's Not verified line.
4. New or moved pages are listed in `docs.json` and `docs/phoenix/llms.txt`.
5. Pages match the structure and tone of their neighbors, with no duplicated drift-prone details where a link to the source would do.
6. Example hostnames use `phoenix.example.com`.
7. Each changed page follows the `phoenix-docs` skill: one Diátaxis type per page, ASD-STE100 Simplified Technical English in how-to guides and reference, and accessible images and videos. The transcript shows phoenix-docs-reviewer's final report, and each of its blocking findings is fixed or disputed in the PR body.
8. Only documentation changes: Markdown and MDX pages, `docs.json`, `llms.txt` and docs assets. No source code, and nothing under `.github/`, `.cursor/`, `.claude/`, `.agents/`, `factory/` or `plugins/`.
9. The PR is a draft against `main` from branch `factory/issue-<number>`, with a `docs:` title and a body that starts with `resolves #<number>`.
10. Exactly one assessment comment on the PR follows `factory/assessment.md` and matches the PR's final state.
