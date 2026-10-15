# Docs rubric (starter - tune from real runs)

1. The change addresses the gap the issue describes, and nothing broader.
2. Every parameter, default, command and code sample matches the current source; the session shows the code that was read to confirm it.
3. New or moved pages are listed in `docs.json` and `docs/phoenix/llms.txt`.
4. Pages match the structure and tone of their neighbors, with no duplicated drift-prone details where a link to the source would do.
5. Example hostnames use `phoenix.example.com`.
6. Only documentation files change: nothing under `src/`, `js/`, `packages/`, `.github/`, `.claude/` or `.agents/`.
7. The PR is a draft against `main` from branch `factory/issue-<number>`, with a `docs:` title, `Closes #<number>`, and the phoenix-pr-description template.
