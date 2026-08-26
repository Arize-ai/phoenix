---
name: project-overview
description: >
  Get oriented in a Phoenix project before answering questions about it: which
  projects exist, how much traffic each carries, and where the errors and latency
  are. Load this when a user asks what is in a project, whether it is healthy,
  or where to start looking, and you have not yet looked at its data.
summary: Orient in a Phoenix project — traffic, errors, latency — before digging into traces.
---

# Project overview

Answer from live data, never from memory. The tools in front of you reach the
Phoenix REST API and a read-only analytics SQL surface; find the ones you need
with the discovery tools the server advertises (`list_tool_groups` and
`enable_tool_group`, or `search` and `execute` under code mode).

## Steps

1. **Find the project.** List projects and match the one the user means by
   name. If they name none and there is more than one, show the list with each
   project's trace count and ask which they mean rather than picking.
2. **Size the traffic.** For the chosen project, count traces and spans over
   the window the user cares about (default: the last 24 hours), and note the
   root-span names that dominate. Aggregates belong in SQL: describe the schema
   first, then run one statement that groups by span name and status.
3. **Locate the problems.** Report the error rate and latency percentiles
   (p50, p95) per root-span name. Then pull a handful of the slowest and the
   failing spans and read their status messages and truncated input/output —
   enough to say what kind of failure it is, not the full payload.
4. **Report.** Lead with the one or two findings that matter, each backed by a
   number and an example span ID. Say which window you looked at. Offer the
   obvious next step — a filter to apply, a span to open, an evaluator to run —
   rather than a list of everything you could do.

## Keep in mind

- Span payloads can be large; survey with truncated values and read a full
  payload only for spans you have already decided to inspect.
- A project with no data in the window is a finding in itself: say so, and
  widen the window once before concluding nothing is being traced.
