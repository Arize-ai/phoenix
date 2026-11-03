# Finish rubric (starter - tune from real runs)

The session ends in exactly one of two states. Grade the criteria for the state it reached, from the PR, its issue and the session transcript.

## State A: the pull request was finished

1. The PR body starts with `resolves #<number>`, and that issue describes the bug or feature the diff addresses. An issue the session filed follows the repo's issue template for its type, carries the template's labels, and copies no text from the PR.
2. The transcript shows the verdict graded by `factory/agents/pr-reviewer.md` § Verdict, with each area reviewer's final report quoted verbatim, and the verdict was not Close.
3. For a bug fix, the reproducer's report shows the PR's test failing without the fix and an acceptance test with the symptom absent on the fixed tree, or says why the sandbox could not run them; for a feature, the analyst's verify report shows the behavior present. A failure there was treated as a blocking finding.
4. Every blocking and non-blocking finding from the reviewers and the verification is fixed in the diff, or the PR body lists the ones the session disputes and why. The fixes follow the project's conventions, not the PR's.
5. Every test in the PR exercises real code and would fail if the change were reverted. None hand-writes a fake GraphQL or REST server, fakes layout or scroll metrics, mocks the module under test, or silences warnings so fake payloads pass.
6. The format, lint and typecheck targets for every touched area, and the tests next to the changed code, ran and passed in the transcript after the last fix.
7. The session's commits were appended to the PR's branch: no amend, rebase, squash or force-push, and the contributor's commits are unchanged. Commit messages are conventional commits, and so is the PR title.
8. No file under `.github/`, `.cursor/`, `.claude/`, `.agents/`, `factory/` or `plugins/`, nor any `AGENTS.md` or `CLAUDE.md`, was modified by the session; one the PR already changed is named in the assessment.
9. Changed `js/packages/` packages have a changeset; no `pyproject.toml` gains a pre-release production dependency.
10. The PR body has a Verified line naming the commands that ran and a Not verified line naming what the sandbox couldn't run.
11. Exactly one comment to the author lists what changed, grouped by finding, with the rule or convention behind each, and matches the final diff.
12. Exactly one assessment comment follows `factory/assessment.md`, matches the PR's final state, and takes its risk ratings from the reviewers' risk lines.

## State B: the pull request was closed

1. The transcript shows the verdict graded by `factory/agents/pr-reviewer.md` § Verdict as Close, or shows that Fit fails and the fix would be a rewrite, with the evidence.
2. One comment on the PR names the rule and tells the contributor what it means for them, in one paragraph.
3. The PR is closed, its issue exists and is labeled `factory`, and no commit was pushed to the PR's branch.
