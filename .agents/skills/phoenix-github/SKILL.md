---
name: phoenix-github
description: Manage GitHub issues, labels, and project boards for the Arize-ai/phoenix repository. Use when filing roadmap issues, triaging bugs, applying labels, managing the Phoenix roadmap project board, or querying issue/project state via the GitHub CLI.
license: Apache-2.0
metadata:
  author: oss@arize.com
  version: "1.0.0"
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
| `c/agents` | In-browser or terminal AI agents for Phoenix |
| `c/client` | Python/TypeScript SDK and REST client |
| `c/rbac` | Role-based access control |
| `c/auth` | Authentication |
| `c/infra` | Infrastructure, jobs, storage connectors |
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
| `design` | Needs design work before engineering |
| `onboarding` | Related to new-user onboarding flows |
| `phoenix-cloud` | Arize-hosted Phoenix (cloud) specific |

---

## Roadmap Issues

Roadmap issues are high-level epics representing product initiatives.

### Title Format

```
🗺️ [category] Title
```

**Categories:** `ui/ux`, `agents`, `infrastructure`, `datasets/experiments`, `tracing`, `enterprise`, `server-evals`, `annotations`, `evals`, `prompts`, `sdk/connectors`

### Labels per Category

| Category | Labels |
|---|---|
| `ui/ux` | `roadmap`, `priority: highest`, `c/ui` |
| `agents` | `roadmap`, `priority: highest`, `c/agents` |
| `infrastructure` | `roadmap`, `priority: highest`, `c/infra` |
| `datasets/experiments` | `roadmap`, `priority: highest`, `c/datasets`, `c/experiments` |
| `tracing` | `roadmap`, `priority: highest`, `c/traces` |
| `enterprise` | `roadmap`, `priority: highest`, `c/rbac`, `c/auth` |
| `server-evals` | `roadmap`, `priority: highest`, `c/evals`, `c/server` |
| `annotations` | `roadmap`, `priority: highest`, `c/annotations` |
| `evals` | `roadmap`, `priority: highest`, `c/evals` |
| `evals` (with playground) | `roadmap`, `priority: highest`, `c/evals`, `c/playground` |
| `prompts` | `roadmap`, `priority: highest`, `c/prompts`, `c/playground` |
| `sdk/connectors` | `roadmap`, `priority: highest`, `c/client` |

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

## Existing Roadmap Issues (Q2 2026)

Issues #11618–#11666 on the Phoenix roadmap project (Start: 2026-02-20, Target: 2026-08-31):

| # | Category | Title |
|---|---|---|
| #11618 | ui/ux | Onboarding Tracing |
| #11619 | ui/ux | Onboarding for Evals / Datasets |
| #11620 | ui/ux | Home page |
| #11621 | ui/ux | Recents / Favorites |
| #11622 | ui/ux | AI Components |
| #11623 | ui/ux | Agent Sidebar |
| #11624 | ui/ux | File Drag-Drop |
| #11625 | ui/ux | Command K |
| #11626 | agents | Agent API |
| #11627 | agents | Routing |
| #11628 | agents | Tools |
| #11629 | infrastructure | Jobs |
| #11630 | infrastructure | Blob Store Connector |
| #11631 | infrastructure | Web Hooks |
| #11632 | datasets/experiments | External ID / Patch Declarative Datasets |
| #11633 | datasets/experiments | Schemas |
| #11634 | datasets/experiments | Files / Images |
| #11635 | datasets/experiments | Dataset as a Spreadsheet UX |
| #11636 | datasets/experiments | Annotations / Corrections on Experiments |
| #11637 | datasets/experiments | Experiment Charts |
| #11638 | datasets/experiments | Multi-User Support |
| #11639 | tracing | Attribute Filters |
| #11640 | tracing | Attribute Columns |
| #11641 | tracing | AI Search |
| #11642 | tracing | Online Evals |
| #11643 | tracing | Triggers |
| #11644 | tracing | Custom Trace Views |
| #11645 | tracing | Resource Tags |
| #11646 | enterprise | Custom RBAC |
| #11647 | enterprise | Custom Roles |
| #11648 | server-evals | Code Evaluators |
| #11649 | server-evals | Code Evaluator Packages |
| #11650 | server-evals | Project Evaluators |
| #11651 | annotations | Annotation Queues |
| #11652 | annotations | Optimization Direction UX |
| #11653 | annotations | Numeric Thresholding |
| #11654 | evals | Trajectory Evals |
| #11655 | evals | Multimodal Evals |
| #11656 | evals | Pairwise Evals |
| #11657 | evals | Agent as a Judge |
| #11658 | evals | Evals UX |
| #11659 | prompts | Model Configs |
| #11660 | prompts | Model Profiles |
| #11661 | prompts | Vendor Tools / Web Search |
| #11662 | prompts | Multiple Playgrounds |
| #11663 | prompts | Chat with Your Prompt |
| #11664 | prompts | Edit / Append to Dataset on Playground |
| #11665 | sdk/connectors | Session APIs |
| #11666 | sdk/connectors | Vitest / Pytest Integration |
