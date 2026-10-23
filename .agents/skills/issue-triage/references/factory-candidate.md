# Policy: factory-candidate

**Gate label:** `factory-candidate` — an issue the factory (`factory/README.md`)
can take to a reviewable PR without a human first deciding anything.

The label nominates; it never starts a run on its own. After each triage run,
`factory-candidates.yml` starts the factory for candidates whose author has
write access to the repository. Every other candidate waits for a maintainer to
add the `factory` label.

## Audience

Managed agents in a sandbox with the repo checked out, `make setup`, PyPI and
npm, and the GitHub MCP server. Nothing else: no live LLM provider, cloud
service or customer deployment, and no one to ask mid-run.

That sets the bar. The agent must be able to show the problem in the sandbox
before changing anything: a bug needs a test that fails for the reported
reason, a feature needs a probe showing `main` lacks it. An issue the agent can
only reason about, not run, burns a session and ends `manual`.

## Qualifies when all four hold

| Condition | How to check |
| --- | --- |
| **Specified** | Passed stage 2. An issue carrying `needs information` never qualifies |
| **Typed** | `bug` or `enhancement` from stage 1, or `documentation`. The label picks the factory's lane |
| **Scoped** | `size:S` or `size:M`. `size:L` never qualifies: the factory refuses it, and a PR must stay under 400 changed lines |
| **Checkable** | A bug names inputs and an observed result a test can reproduce. An enhancement states the expected behavior concretely enough to show `main` lacks it. A docs issue names the page and what it should say |

## Never label when any one holds

- **`assignees` is non-empty**, or an open PR already addresses it (`gh issue
  view <number> --json closedByPullRequestsReferences`) — the factory refuses
  both
- it carries `agent-in-progress`, `good-agent-issue`, `blocked`, `needs
  information`, `cannot reproduce`, `duplicate`, or `stale`
- it carries `good first issue` or `good student issue` — those are kept for
  people
- it needs a product or design decision first: choosing between approaches,
  naming a public API, or changing default behavior
- a fix would change `.github/`, `.cursor/`, `.claude/`, `.agents/`, `factory/`,
  `plugins/`, an `AGENTS.md` or a `CLAUDE.md` — Factory Guard fails those PRs
- reproducing it needs something the sandbox lacks: a live provider API key, a
  third-party service, a specific customer deployment, or hardware
- it touches user management, permissions, auth, or secrets handling —
  including anything labelled `c/auth` or `c/rbac`
- it is an epic — a checklist of sub-tasks rather than one change
