# PXI Server-Centric Migration Plan

## Status

Proposed migration plan for moving from the current PXI implementation toward the target architecture described in `docs/pxi-server-centric-architecture.md`.

This document is intentionally opinionated. It assumes PXI should move quickly to a server-owned session runtime rather than spend a long time in a hybrid transitional state.

## Summary

The migration should be short and decisive.

The important change is not "add a CLI." The important change is to stop the browser from being the hidden owner of PXI. Once that happens, cross-surface continuity becomes a natural extension of the architecture instead of a special feature.

The migration should proceed in four major tranches:

1. establish the server-native PXI foundation
2. cut the web experience over to that foundation immediately
3. add runtime attachments, typed context, and server orchestration
4. add Phoenix-owned CLI attachment on top of the fully server-owned web path

This is not intended to be a gradual, long-tail migration.

## Migration Goals

- Move session and message truth to the server as early as possible.
- Make all new PXI message submission server-native.
- Reduce the browser to UI-only authority as soon as the server foundation exists.
- Introduce a logical server-owned tool model before executor-specific routing.
- Introduce typed context artifacts before server-side dispatch routing.
- Explicitly delete browser-owned PXI runtime and persistence abstractions once the new path is live.
- Only begin CLI attachment work after the web PXI path is fully server-owned.

## Migration Non-Goals

- Preserving long-lived browser ownership of PXI session state.
- Maintaining the current ad hoc `/chat` request contract as the canonical interface.
- Keeping local transcript persistence as a fallback after server cutover.
- Building third-party runtimes during this migration.
- Solving every detail of model-visible context representation before the core control plane exists.

## Current Problem Statement

Today, PXI is split across the browser and server in a way that makes the browser the effective owner of the session.

That is the core architectural problem.

The current split creates at least five issues:

1. session continuity depends on browser-owned state
2. tool execution ownership is divided by implementation location rather than architectural role
3. the server sees turns, but not a first-class multi-surface PXI session runtime
4. cross-surface continuation is unnatural because the session is not truly server-owned
5. the browser contains orchestration responsibilities that should belong to the backend

The migration should directly attack those problems rather than preserve them behind compatibility layers.

## Migration Principles

### Server First

The new server abstractions should be introduced before any serious multi-surface work.

### Immediate Web Cutover

Once the server session foundation exists, the web path should cut over quickly rather than remain half-authoritative.

### UI-Only Browser Authority

After cutover, the browser should only own UI concerns such as drafts, panel layout, and transient rendering state.

### Foundations Before Attachments

CLI and other runtime surfaces should not shape the migration before the server owns the web path.

### Context Before Dispatch

Typed context artifacts should exist before server-directed tool routing so dispatch decisions can build on a real session model.

### Explicit Deletion

Legacy client-owned ownership paths should be named and removed explicitly, not left as implied cleanup.

## Tranche 1: Server-Native PXI Foundation

The first tranche establishes the minimum server-side control plane required to make PXI server-owned.

This tranche should include all of the following together:

- server-native PXI session API
- session creation and loading
- append-only session event log or equivalent canonical history record
- session read projections
- server-enforced single in-flight turn control
- `last_touched_surface`
- foundational logical server-owned tool catalog

### What This Tranche Produces

The backend gains first-class concepts for:

- `Session`
- `SessionEvent`
- session status
- active turn ownership
- `last_touched_surface`
- logical tools independent of where they execute

The backend must be able to:

- create a session
- load a session
- accept a new user message through a session-native API
- reject a message when a turn is already in flight
- reconstruct session history from canonical server state

### Important Constraint

Sessions and read projections should land together.

The browser should not be expected to dual-own session truth while waiting for read APIs to catch up.

### Submit Path

As soon as this tranche exists, PXI message submission should move to the server-native session API.

The migration document should treat this as a replacement for the current ad hoc `/chat` request contract, not as an optional wrapper around it.

### Why The Tool Catalog Is Foundational

The logical tool model should exist before routing and orchestration cutover.

Without that, the migration risks preserving the old and misleading split between:

- frontend tools
- backend tools

The server needs a single logical registry of PXI tools before it can reason cleanly about which runtime should execute them.

### Exit Criteria

- PXI sessions exist as first-class backend records.
- The backend can reconstruct session history without browser-local state.
- New messages are submitted through a server-native session API.
- The backend enforces one active turn per session.
- `last_touched_surface` is recorded as part of normal session activity.
- Logical tool definitions exist server-side independently of executors.

## Tranche 2: Immediate Web Cutover

Once the server-native session foundation exists, the web experience should cut over immediately.

This should be a sharp cut, not a long coexistence period.

### What Changes

The web app becomes a client of the server-owned PXI session runtime.

The browser may still own:

- drafts
- panel placement
- purely visual loading state
- transient rendering state

The browser should stop owning:

- durable session history
- durable message persistence
- authoritative turn state
- authoritative session continuity

### Explicit Deletions

This tranche should explicitly remove or deprecate the following client-owned behaviors as soon as the new path is proven:

- local transcript persistence as durable session storage
- browser-owned PXI session ownership
- browser-owned message truth
- any client-side orchestration path that assumes the browser is the runtime owner

The document should treat these as concrete removals, not vague cleanup.

### Local Persistence

Local transcript persistence should be removed promptly after this cutover.

It should not remain as a fallback source of truth.

### Exit Criteria

- Browser refresh does not threaten PXI session continuity.
- The server is the source of truth for PXI messages and session state.
- The browser is authoritative only for UI-only state.
- Local transcript persistence is removed or no longer used as durable truth.

## Tranche 3: Runtime Attachments, Typed Context, And Server Orchestration

After the web path is fully server-owned, the next tranche introduces the infrastructure required for multi-surface PXI and server-directed tool execution.

This tranche should include:

- runtime attachments
- typed context artifacts
- context freshness metadata
- server-owned dispatch selection
- server-owned turn orchestration
- deletion of the browser-owned runtime/orchestration layer

### 3A: Runtime Attachments

Runtime attachments should be introduced early in this tranche, immediately adjacent to the foundation work rather than as a late add-on.

The backend should gain:

- `RuntimeAttachment`
- attach / detach semantics
- heartbeat or last-seen tracking
- runtime type and surface identity

This gives the server a real model of which Phoenix-owned surfaces are attached to a session.

### 3B: Typed Context Artifacts

Before dispatch routing is introduced, PXI should gain typed context artifacts.

The backend should gain:

- `ContextArtifact`
- typed context kinds
- producer surface metadata
- freshness metadata

The exact final representation exposed to the model remains open. That uncertainty is acceptable.

What matters for the migration is that context stops being primarily implicit browser state and becomes explicit session-scoped data.

### Context Freshness

Fresh/stale context semantics should exist in this tranche, but they do not need to fully block later CLI work if initial attachment proves useful first.

The important requirement is that context can outlive a connected runtime and be reasoned about as more or less trustworthy.

### 3C: Server-Oriented Dispatch And Orchestration

Once runtime attachments and typed context exist, the server should take ownership of tool routing and turn orchestration.

This includes:

- server-directed tool dispatch RPCs
- typed tool results returning to the server
- dispatch preference based on executor eligibility and `last_touched_surface`
- server-owned model turn orchestration

This is the point where the browser must stop acting like the hidden runtime manager for PXI.

### Explicit Deletions In This Tranche

Once server orchestration is live, the migration should explicitly delete browser-owned runtime ownership abstractions.

That includes naming concrete removals such as:

- browser-owned chat runtime/session registry
- client-side orchestration paths that manage durable tool continuation
- any remaining ownership assumptions embedded in client-side session/runtime layers

The browser may still render streams and collect user input. It should no longer own PXI runtime continuity.

### Exit Criteria

- The server knows which runtime surfaces are attached to a session.
- Context artifacts exist as typed session-scoped data.
- Tool routing decisions are server-owned.
- `last_touched_surface` participates in dispatch selection.
- The server owns turn orchestration.
- Browser-owned PXI runtime ownership abstractions are explicitly removed.

## Tranche 4: Phoenix-Owned CLI Attachment

CLI work should begin only after the web path is fully server-owned.

The CLI should not be used to shape or justify an extended hybrid period.

### Initial Scope

The initial CLI scope should be intentionally narrow:

- attach to an existing PXI session
- contribute read-only local workspace context
- satisfy read-only inspection tools
- participate in the same canonical session

It should not initially include:

- file editing
- commit flows
- autonomous mutation of a local repo

### Expected Behavior

When a CLI runtime attaches:

- it becomes a `RuntimeAttachment`
- it declares available tool and context capabilities
- it may update `last_touched_surface` when the user becomes active there
- its contributed context becomes part of the same session

Tool routing should then be able to prefer the CLI when:

- the logical tool is eligible for the CLI
- the CLI is attached and healthy
- the session's `last_touched_surface` points there

### Context Freshness Note

Initial CLI attachment does not need to wait for a perfect final design for stale context handling.

However, the session model must already be capable of marking persisted context as no longer fresh when a runtime disconnects or stops updating.

### Exit Criteria

- A CLI can attach to a session created in the web app without forking it.
- CLI context becomes part of the same canonical session.
- Eligible tools can dispatch to the CLI using the same server-owned routing model.
- The web and CLI both behave as surfaces attached to the same PXI runtime.

## What Should Not Happen During Migration

The migration plan should explicitly avoid these failure modes:

### Long-Lived Dual Ownership

Do not preserve a state where the server and browser both appear to own session truth for a long period.

### CLI Before Web De-Ownership

Do not start CLI attachment work while the web path still depends on browser-owned session continuity.

### Tool Model Drift

Do not let executor-specific tool definitions become the long-term architecture.

### Hidden Compatibility Layers

Do not preserve old client-owned runtime logic behind internal compatibility wrappers longer than necessary.

## Risks

### Sharp Cutover Risk

A fast cutover increases short-term implementation risk.

That is acceptable here. PXI is a beta feature, and avoiding a long-tail hybrid architecture is more important than preserving every transitional behavior.

### Server Complexity Risk

Server orchestration and dispatch will increase backend complexity.

That is expected and desirable if PXI is to become a real multi-surface runtime.

### Context Shape Uncertainty

The final shape of model-visible context remains open.

That should not block the migration. The typed context artifact model is the important step.

## Definition Of Done

The migration is complete when:

- PXI sessions are server-owned.
- PXI messages are server-owned.
- the web path is a thin client over a server-native session runtime.
- logical tools are defined server-side independently of executors.
- runtime attachments and typed context artifacts exist.
- the server owns dispatch and orchestration.
- browser-owned runtime/session ownership abstractions are removed.
- a Phoenix-owned CLI can attach to the same canonical PXI session.

## Follow-Up Planning Document

After this migration plan, the next planning artifact should be a concrete implementation roadmap against the current Phoenix codebase that maps these tranches to actual files, seams, and likely first cuts.
