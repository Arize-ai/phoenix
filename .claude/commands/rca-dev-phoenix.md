---
description: Root-cause analysis of the dev Phoenix deployment (MCP). Does not commit or open a PR.
argument-hint: "[project] [lookback_hours]"
---

Run root-cause analysis on dev Phoenix using the `rca-dev-phoenix` skill.

Project: $1 (default pxi_dev) · Lookback: $2 hours (default 24)
Follow the skill exactly. You MUST NOT commit, push, or open a PR — a later
CI step does that. Emit your outputs to the scratch files the skill specifies
(`.scratch/pr-title.txt`, `.scratch/pr-body.md`, or `.scratch/rca-findings.md`).
