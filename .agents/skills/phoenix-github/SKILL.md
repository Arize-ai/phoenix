---
name: phoenix-github
description: Manage GitHub issues, labels, and project boards for the Arize-ai/phoenix repository. Use when filing roadmap issues, triaging bugs, applying labels, managing the Phoenix roadmap project board, or querying issue/project state via the GitHub CLI.
license: Apache-2.0
metadata:
  author: oss@arize.com
  version: "1.1.0"
  internal: true
---

# Phoenix GitHub

Reference for managing issues, labels, and project boards on the `Arize-ai/phoenix` repository using the `gh` CLI.

## Repository

```
Arize-ai/phoenix
```

## Quick Reference

| Task | See |
|---|---|
| File a roadmap epic | [Roadmap Issues](#roadmap-issues) |
| Apply the right labels | [Label Taxonomy](#label-taxonomy) |
| Add an issue to the roadmap project | [Project Board](#project-board) |
| Set project dates or status | [Project Board](#project-board) |
| Create a bug or feature request | [Standard Issues](#standard-issues) |

---

## Label Taxonomy

### Component Labels (`c/`)

Every issue should have at least one component label.

| Label | Area |
|---|---|
| `c/ui` | Frontend / React UI |
| `c/server` | FastAPI backend / server logic |
| `c/traces` | Tracing, spans, OpenTelemetry ingestion |
| `c/evals` | Evaluations framework |
| `c/datasets` | Datasets CRUD and management |
| `c/experiments` | Experiment runs and comparisons |
| `c/annotations` | Human annotations and queues |
| `c/prompts` | Prompt management and prompt SDK |
| `c/playground` | LLM playground and provider support |
| `c/agents` | In-browser or terminal AI agents for Phoenix (PXI) |
| `c/client` | Python/TypeScript SDK and REST client |
| `c/cli` | `@arizeai/phoenix-cli` |
| `c/api` | REST API surface |
| `c/sessions` | Sessions and session tracking |
| `c/otel` | OpenTelemetry / OTel ingestion |
| `c/rbac` | Role-based access control |
| `c/auth` | Authentication |
| `c/infra` | Infrastructure, jobs, storage connectors |
| `c/helm` | Helm chart / Kubernetes deployment |
| `c/mcp` | MCP (Model Context Protocol) integration |
| `c/filters` | Filter UI and filter logic |
| `c/metrics` | Metrics and aggregations |
| `c/dx` | Developer experience |

### Priority Labels

| Label | Use |
|---|---|
| `priority: highest` | Roadmap epics and critical P0 bugs |
| `priority: high` | Important but not blocking |
| `priority: medium` | Normal queue work |
| `priority: low` | Nice-to-have |

### Type / Status Labels

| Label | Use |
|---|---|
| `roadmap` | High-level roadmap epic |
| `bug` | Something isn't working |
| `enhancement` | New feature or improvement |
| `documentation` | Docs-only change |
| `triage` | Needs triage by the team |
| `blocked` | Blocked on external dependency |
| `backlog` | Acknowledged but not scheduled |
| `needs information` | Awaiting info from the reporter |
| `design` / `needs design` | Needs design work before engineering |
| `onboarding` | Related to new-user onboarding flows |
| `phoenix-cloud` | Arize-hosted Phoenix (cloud) specific |
| `user request` | Requested by a user |
| `good-agent-issue` | Well-scoped enough for an AI agent to pick up |
| `agent-in-progress` | An agent is currently working on this issue |

---

## Roadmap Issues

Roadmap issues are high-level epics representing product initiatives.

### Title Format

```
🗺️ [category] Title
```

The `🗺️` prefix marks an epic. Sub-issues that roll up under an epic use the same `[category]` bracket but drop the emoji (e.g. `[agents] dataset tools`).

**Categories:** `ui/ux`, `agents`, `tools`, `tracing`/`traces`, `sessions`, `evals`, `server-evals`, `sandboxes`, `annotations`, `prompts`, `datasets/experiments`, `infrastructure`, `enterprise`, `sdk/connectors`. A few standalone epics use a product name instead of a bracket (e.g. `@arizeai/phoenix-cli`, `REST API`).

### Labels per Category

Every roadmap epic gets `roadmap` + `enhancement`. Add `priority: highest` for actively-prioritized epics, plus the relevant component label(s):

| Category | Component labels |
|---|---|
| `ui/ux` | `c/ui` |
| `agents` | `c/agents` |
| `tools` | `c/agents` (often none beyond `roadmap`) |
| `tracing` / `traces` | `c/traces` |
| `sessions` | `c/sessions`, `c/ui` |
| `evals` | `c/evals` (add `c/playground` when playground-related) |
| `server-evals` / `sandboxes` | `c/evals`, `c/server` |
| `annotations` | `c/annotations` |
| `prompts` | `c/prompts`, `c/playground` |
| `datasets/experiments` | `c/datasets`, `c/experiments` |
| `infrastructure` | `c/infra` |
| `enterprise` | `c/rbac`, `c/auth` |
| `sdk/connectors` | `c/client` |
| `@arizeai/phoenix-cli` | `c/cli`, `c/dx` |
| `REST API` | `c/api`, `c/server` |

### Body Template

```markdown
<one-line description of the initiative>

## Spike

- [ ]

## Front End

- [ ]

## Back End

- [ ]

## Open Questions

-
```

### Creating a Roadmap Issue

```bash
gh issue create \
  --repo Arize-ai/phoenix \
  --title "🗺️ [category] Title" \
  --label "roadmap,priority: highest,c/ui" \
  --body "$(cat <<'EOF'
Description of the initiative.

## Spike

- [ ]

## Front End

- [ ]

## Back End

- [ ]

## Open Questions

-
EOF
)"
```

---

## Project Board

### Phoenix Roadmap (Project #45)

The canonical roadmap board for open-source Phoenix.

| Field | ID |
|---|---|
| Project ID | `PVT_kwDOA5FfSM4AJaRo` |
| Start Date | `PVTF_lADOA5FfSM4AJaRozgInoCI` |
| Target Date | `PVTF_lADOA5FfSM4AJaRozgInn58` |
| Status | `PVTSSF_lADOA5FfSM4AJaRozgFw9n0` |

**Status option IDs:**

| Status | Option ID |
|---|---|
| Todo | `f75ad846` |
| In Progress | `47fc9ee4` |
| Done | `98236657` |

### Add an Issue to the Project

```bash
# 1. Get the issue node ID
NODE_ID=$(gh api repos/Arize-ai/phoenix/issues/{number} --jq '.node_id')

# 2. Add to project, capture item ID
ITEM_ID=$(gh api graphql -f query='
  mutation($project: ID!, $content: ID!) {
    addProjectV2ItemById(input: {projectId: $project, contentId: $content}) {
      item { id }
    }
  }' \
  -f project="PVT_kwDOA5FfSM4AJaRo" \
  -f content="$NODE_ID" \
  --jq '.data.addProjectV2ItemById.item.id')
```

### Set Start / Target Date

```bash
gh api graphql -f query='
  mutation($project: ID!, $item: ID!, $field: ID!, $value: Date!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $project, itemId: $item, fieldId: $field,
      value: {date: $value}
    }) { projectV2Item { id } }
  }' \
  -f project="PVT_kwDOA5FfSM4AJaRo" \
  -f item="$ITEM_ID" \
  -f field="PVTF_lADOA5FfSM4AJaRozgInoCI" \  # Start Date field
  -f value="2026-04-01"
```

### Set Status

```bash
gh api graphql -f query='
  mutation($project: ID!, $item: ID!, $field: ID!, $option: String!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $project, itemId: $item, fieldId: $field,
      value: {singleSelectOptionId: $option}
    }) { projectV2Item { id } }
  }' \
  -f project="PVT_kwDOA5FfSM4AJaRo" \
  -f item="$ITEM_ID" \
  -f field="PVTSSF_lADOA5FfSM4AJaRozgFw9n0" \
  -f option="47fc9ee4"   # In Progress
```

### Remove an Issue from a Project

Requires the project item ID (not the issue number). Paginate if the project has many items:

```bash
gh api graphql -f query='
  mutation($project: ID!, $item: ID!) {
    deleteProjectV2Item(input: {projectId: $project, itemId: $item}) {
      deletedItemId
    }
  }' \
  -f project="PVT_kwDOA5FfSM4AJaRo" \
  -f item="$ITEM_ID"
```

> **Note:** `gh issue create` does not support `--json`. Capture the issue URL from stdout and extract the number with `grep -oE '[0-9]+$'`.

---

## Standard Issues

### Bug Report

```bash
gh issue create \
  --repo Arize-ai/phoenix \
  --title "Short description of the bug" \
  --label "bug,triage,c/traces" \
  --body "..."
```

### Feature Request

```bash
gh issue create \
  --repo Arize-ai/phoenix \
  --title "Short description of the feature" \
  --label "enhancement,c/ui" \
  --body "..."
```

---

## Querying the Roadmap

The roadmap is large and changes constantly, so query it live rather than relying on a snapshot. The current epics seed from #11618–#11666 (Start: 2026-02-20, Target: 2026-08-31), with newer epics in the #12xxx–#13xxx range.

```bash
# All open roadmap epics, newest first
gh issue list --repo Arize-ai/phoenix --label roadmap --state open \
  --limit 100 --json number,title,labels \
  --jq '.[] | "\(.number)\t\(.title)"'

# Filter to a category (e.g. agents)
gh issue list --repo Arize-ai/phoenix --label roadmap --state open \
  --search "in:title [agents]" --json number,title \
  --jq '.[] | "\(.number)\t\(.title)"'

# Roadmap epics for a component (e.g. evals)
gh issue list --repo Arize-ai/phoenix --label "roadmap,c/evals" --state open \
  --json number,title --jq '.[] | "\(.number)\t\(.title)"'
```

Epics group their child issues as a markdown checklist in the body (often bucketed by Phoenix surface — Datasets, Prompts, Playground, Experiments, Evals — with a `## ✅ Completed` section). When filing a sub-issue, link it back from the parent's checklist.
