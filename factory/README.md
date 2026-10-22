# Factory

Claude Managed Agents that take a triaged Phoenix issue to a PR that is ready for human review. Every agent, environment and vault is defined by a file here and synced with [`ant apply`](https://platform.claude.com/docs/en/cli-sdks-libraries/cli/apply). Git is the source of truth, and `claude-lock.json` records the IDs.

## Flow

```
Issue ─ `factory` label ─┬─ bug ─────────── bug-fixer ─────── reproduce → fix → review ⟲ ──┐
(maintainer)             ├─ enhancement ─── feature-builder ─ analyze → build → review ⟲ ──┼─→ draft PR ─ CI ⟲ ─ bot review ⟲ ─→ ready PR → merge (human)
                         └─ documentation ─ docs-writer ───── write docs ──────────────────┘
```

| Stage | Implemented by |
|---|---|
| Issue | A maintainer adds the `factory` label, or runs the dispatch workflow by hand |
| Admission | `dispatch.py start` skips issues that are closed, assigned, labeled `needs information` or `size:L`, untyped, or already addressed by an open PR, and says why on the issue |
| Identify type | The `bug` / `enhancement` / `documentation` labels pick the lane; a manual dispatch can override it |
| Reproduce | `bug-reproducer`, which must produce a failing test before any fix is written |
| Analyze feature | `feature-analyst`, which first runs a probe showing `main` lacks the behavior, then slices the work into PRs under 400 changed lines, or returns `NEEDS_DECISION` when a human has to choose |
| Implement | The lane coordinator (`bug-fixer`, `feature-builder`), after `bootstrap.sh` prepares the sandbox |
| Review ⟲ Revise | Area reviewers chosen by the paths the diff touches (`server-reviewer`, `frontend-reviewer`, `packages-reviewer`) report per `REVIEW.md` § Reporting Findings with a risk line each, and the session outcome's grader scores `rubrics/<lane>.md` |
| Assess | The coordinator posts `assessment.md` on the PR: fit, evidence, the reviewers' risk ratings, and a review depth of glance, focused or deep |
| CI ⟲, bot review ⟲ | `dispatch.py watch` sends failing required checks, then the Claude Code Review findings, back to the session, up to three rounds, and marks the PR ready once required CI passes |
| Report | `dispatch.py watch` comments the run outcome, rubric result and cost on the issue, then removes the `factory` label |
| Merge | A human |

Each lane runs as one multiagent session: the coordinator delegates to its roster, and every thread shares the mounted repo at `/workspace/phoenix`.

A maintainer's part is to label an issue, answer the questions on a `NEEDS_DECISION` comment, and review PRs once they leave draft, as deeply as the assessment's review depth says. To run an issue again, re-add the `factory` label.

## Run outcomes

Every report on the issue names how the run ended. Only `success` asks for a human review; the other outcomes are the factory's own backlog:

| Outcome | Meaning | Fix |
|---|---|---|
| `success` | A PR passed required CI and the automated review and is ready for review | None |
| `flawed` | The agent produced the wrong thing: rubric not met, CI or review findings still open | Improve the agent's prompt, its rubric, or `REVIEW.md` |
| `blocked` | The run lacked something: budget, time, a credential, or a check it can't fix such as the CLA | Provision it |
| `manual` | A boundary drawn on purpose: `NEEDS_DECISION`, not reproduced, or a closed PR | Decide whether the factory should handle it next time |

## Layout

```
agents/          one file per agent: frontmatter = config, body = system prompt
environments/    the sandbox (uv, tox, pnpm, limited networking)
vaults/          the vault container; its credential is added by hand
rubrics/         outcome rubrics, inlined by dispatch.py (not ant resources)
assessment.md    the fit-and-risk comment coordinators post on their PR
bootstrap.sh     run by each coordinator first: Node from .nvmrc, `make setup`, a capability report
dispatch.py      admits an issue, starts its session, and follows it to a reviewable PR
claude-lock.json written by ant apply - commit it
```

Workflows: `factory-sync.yml` (plan on PR, apply on merge), `factory-dispatch.yml` (start and watch a session), and `factory-guard.yml` (fail factory PRs that touch `.github/`, `.cursor/`, `.claude/`, `.agents/`, `factory/`, `plugins/`, `AGENTS.md` or `CLAUDE.md`).

## Bootstrap

1. Install `ant` (>= 1.40.0) and authenticate against the workspace the factory will live in.
2. From this directory: `ant apply --dry-run -v .`, then `ant apply .`. Commit the `claude-lock.json` it writes.
3. Create a machine GitHub account with write access, not admin, so branch protection applies to it. Give it a fine-grained PAT for this repo with Contents and Pull requests read/write and no Workflows access. Code in the sandbox can use this token for the whole session.
4. Add the PAT to the vault (its ID is in `claude-lock.json` under `./vaults/github.yaml`) as a `static_bearer` credential for `https://api.githubcopilot.com/mcp/`, using `ant beta:vaults:credentials create`. The machine account then authors factory PRs, so any maintainer can approve them.
5. Create the repo secrets `FACTORY_ANTHROPIC_API_KEY`, `FACTORY_GITHUB_TOKEN` (the PAT) and `FACTORY_PUSH_TOKEN` (allowed to push `claude-lock.json` to `main`). Create the repo variables `FACTORY_GIT_NAME` and `FACTORY_GIT_EMAIL` with the machine account's name and noreply email, and add its login to the `allowlist` in `cla.yml`.
6. Create the `factory` label, and make `Factory Guard` a required check on `main`.
7. Try it on one small issue with **Run workflow** on `Factory Dispatch`.

## Changing an agent

Edit its file and open a PR. The sync workflow prints the plan, and merging applies it as a new agent version.
