# Agent factory

Claude Managed Agents that take a triaged Phoenix issue to a draft PR. Every agent, environment and vault is defined by a file here and synced with [`ant apply`](https://platform.claude.com/docs/en/cli-sdks-libraries/cli/apply). Git is the source of truth, and `claude-lock.json` records the IDs.

## Flow

```
Issue ── triage labels ──┬─ bug ─────────── bug-fixer ─────── reproduce → fix → review ⟲ revise ──┐
(human)  (claude-issue-  ├─ enhancement ─── feature-builder ─ analyze → implement → review ⟲ ─────┼─→ draft PR → merge (human)
          triage.yml)    └─ documentation ─ docs-writer ───── write docs ────────────────────────────┘
```

| Stage | Implemented by |
|---|---|
| Issue | A maintainer adds the `agent-factory` label, or runs the dispatch workflow by hand |
| Identify type | The `bug` / `enhancement` / `documentation` labels set by `claude-issue-triage.yml`; `dispatch.py` maps them to a lane |
| Reproduce | `bug-reproducer`, which must produce a failing test before any fix is written |
| Analyze feature | `feature-analyst`, read-only; returns `NEEDS_DECISION` when a human has to choose |
| Implement / Create fix | The lane coordinator (`bug-fixer`, `feature-builder`) |
| Review ⟲ Revise | Area reviewers chosen by the paths the diff touches (`server-reviewer`, `frontend-reviewer`, `packages-reviewer`), plus the session outcome's grader scoring `rubrics/<lane>.md` |
| Merge | A human |

Each lane runs as one multiagent session: the coordinator delegates to its roster, and every thread shares the mounted repo at `/workspace/phoenix`.

## Layout

```
agents/          one file per agent: frontmatter = config, body = system prompt
environments/    the sandbox (uv + pnpm, limited networking)
vaults/          the vault container; its credential is added by hand
rubrics/         outcome rubrics, inlined by dispatch.py (not ant resources)
dispatch.py      routes an issue to a lane and starts its session
claude-lock.json written by ant apply - commit it
```

Workflows: `agent-factory-sync.yml` (plan on PR, apply on merge), `agent-factory-dispatch.yml` (start a session), and `agent-factory-guard.yml` (fail factory PRs that touch `.github/`, `.claude/`, `.agents/`, `agent-factory/`, `AGENTS.md` or `CLAUDE.md`).

## Bootstrap

1. Install `ant` (>= 1.34.0) and authenticate against the workspace the factory will live in.
2. From this directory: `ant apply --dry-run -v .`, then `ant apply .`. Commit the `claude-lock.json` it writes.
3. Add the GitHub MCP OAuth credential to the vault (its ID is in `claude-lock.json` under `./vaults/github.yaml`), keyed by `https://api.githubcopilot.com/mcp/`, using `ant beta:vaults:credentials create`.
4. Create the repo secrets `AGENT_FACTORY_ANTHROPIC_API_KEY`, `AGENT_FACTORY_GITHUB_TOKEN` (a fine-grained PAT with Contents read/write) and `AGENT_FACTORY_PUSH_TOKEN` (allowed to push `claude-lock.json` to `main`).
5. Create the `agent-factory` label, and make `Agent Factory Guard` a required check on `main`.
6. Try it on one small issue with **Run workflow** on `Agent Factory Dispatch`.

## Changing an agent

Edit its file and open a PR. The sync workflow prints the plan, and merging applies it as a new agent version.
