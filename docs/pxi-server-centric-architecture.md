# PXI Server-Centric Architecture

## Status

Aspiration / target architecture.

This document describes the desired long-term architecture for PXI as a server-owned, multi-surface agent runtime. It intentionally does not preserve current implementation constraints.

## Summary

PXI should evolve into a single server-owned session runtime that can be accessed from multiple Phoenix-owned interfaces, including the web app and CLI, while remaining the same logical session.

The server owns the session, orchestration, tool routing, event log, and policy. Interfaces attach to that session as runtime surfaces that declare typed tool and context capabilities. The model runs on the server. Tool execution is dispatched to the most appropriate attached runtime, usually the session's `last_touched_surface`.

This architecture is designed to support:

- the same PXI session across web and CLI
- interface-specific context injection
- interface-specific tool execution
- clear concurrency rules
- portable session history and observability
- future support for IDE/MCP-style surfaces without changing the core session model

## Goals

- Make the server the source of truth for PXI session state.
- Preserve one canonical session across browser and CLI handoff.
- Allow multiple attached runtimes to contribute tools and context to the same session.
- Keep model execution centralized on the server.
- Make tool availability dynamic based on attached runtime capabilities.
- Treat context as strongly typed session data, not prompt-only prose.
- Support read-only inspect/suggest workflows against a real local codebase.
- Ensure deterministic tool dispatch and prevent multi-surface contention.

## Non-Goals

- File editing, commits, or high-trust autonomous code modification.
- Support for third-party runtimes outside Phoenix-owned surfaces.
- Detailed migration sequencing from the current implementation.
- Locking the exact persistence format for context payloads.

## Principles

### One Session

PXI has one canonical session regardless of which interface the user is using.

### Server-Owned Runtime

The server owns orchestration, state transitions, tool dispatch, and the model loop.

### Attached Interfaces

Web and CLI are attached runtime surfaces, not separate PXI instances.

### Logical Tools, Physical Executors

Tools are defined once as logical capabilities. Execution is routed to a runtime that can satisfy them.

### Typed Context

Context is stored and exchanged as typed session artifacts. Prompt text is a rendering layer, not the source of truth.

### Deterministic Dispatch

When multiple runtimes are attached, tool dispatch should be deterministic and predictable.

### No Concurrent Turns

Only one in-flight model turn may exist per session. Additional message submissions are rejected while a turn is active.

## Core Concepts

### PXI Session

The canonical long-lived record for a PXI conversation.

Owns:

- session identity
- event log
- message history projections
- pending turn state
- attached runtime records
- current capability inventory
- context artifacts and freshness state
- last touched surface

### Runtime Attachment

A live Phoenix-owned interface connected to a session.

Examples:

- `web:<id>`
- `cli:<id>`

An attachment advertises:

- runtime type
- connection status
- supported tool executors
- supported context providers
- principal / auth identity
- freshness heartbeat

### Logical Tool

A typed tool contract known to the PXI server.

A logical tool declares:

- stable tool name
- schema for inputs and outputs
- trust level
- whether it is read-only or mutating
- required context kinds
- eligible runtime types
- fallback behavior when no eligible runtime is attached

### Context Artifact

A typed context payload contributed by an attached runtime or the server.

Examples:

- current Phoenix page context
- selected trace / span / project context
- current filters / time range
- repository workspace context
- git status context
- detected agent framework context

Each artifact has freshness metadata so PXI can reason about trust.

## High-Level Architecture

PXI consists of six logical layers:

1. `PXI Session Service`
2. `PXI Orchestrator`
3. `Tool Catalog`
4. `Context Registry`
5. `Runtime Gateways`
6. `Surface Clients`

### 1. PXI Session Service

The persistent control plane for PXI.

Responsibilities:

- create and load sessions
- persist event log and projections
- track attached runtimes
- track session status and locks
- store `last_touched_surface`
- expose session inspection APIs

### 2. PXI Orchestrator

Runs the server-side agent loop.

Responsibilities:

- build the model-visible view of the session
- select eligible logical tools
- invoke the model
- dispatch tool calls to runtimes
- receive tool results
- continue the loop until completion
- enforce single in-flight turn semantics

### 3. Tool Catalog

The system-wide registry of logical PXI tools.

Responsibilities:

- maintain tool contracts
- maintain executor eligibility rules
- maintain policy and trust metadata
- validate tool inputs and outputs

### 4. Context Registry

The typed store of session context artifacts.

Responsibilities:

- accept context contributions from runtimes
- record freshness / staleness metadata
- assemble context projections for the model
- expose context to tool dispatchers

### 5. Runtime Gateways

Server-side adapters that communicate with attached runtimes.

Responsibilities:

- register runtime attachments
- negotiate tool and context capabilities
- dispatch tool RPCs
- receive tool results
- receive context updates
- detect disconnects and stale attachments

### 6. Surface Clients

Phoenix-owned user-facing interfaces such as the web app and CLI.

Responsibilities:

- attach to an existing session
- render session state
- submit user messages
- advertise runtime capabilities
- contribute context artifacts
- satisfy dispatched tool calls

## Data Model

The exact storage schema is intentionally open, but the architecture assumes the following first-class entities.

### Session

- `id`
- `status`
- `last_touched_surface`
- `active_turn_id`
- `created_at`
- `updated_at`

`status` should be an explicit state machine, for example:

- `idle`
- `running`
- `awaiting_tool_result`
- `awaiting_user_input`
- `completed`
- `failed`

### RuntimeAttachment

- `id`
- `session_id`
- `surface_key` such as `web:abcd` or `cli:1234`
- `runtime_type`
- `connection_status`
- `principal_id`
- `declared_tool_capabilities`
- `declared_context_capabilities`
- `last_seen_at`

### SessionEvent

Canonical append-only event log.

Examples:

- user message submitted
- assistant turn started
- tool requested
- tool dispatched to runtime
- tool result received
- context updated
- runtime attached
- runtime detached
- session marked stale

### ContextArtifact

- `id`
- `session_id`
- `kind`
- `producer_surface`
- `payload`
- `freshness_state`
- `captured_at`
- `expires_at` or equivalent freshness metadata

Freshness states should include at least:

- `fresh`
- `stale`

## Concurrency Model

PXI sessions should allow multiple attached runtimes, but only one active model turn.

Rules:

1. A session may have many runtime attachments.
2. Only one user-submitted turn may be in flight at a time.
3. If a new message arrives while a turn is active, the request is rejected.
4. Tool execution for the active turn may involve one or more attached runtimes, but all work remains part of the same orchestrated turn.

This avoids conflicting tool loops and preserves a clear session timeline.

## Tool Dispatch Model

### Dispatch Rule

By default, tool execution should be routed to the session's `last_touched_surface` when that surface is attached and declares support for the requested logical tool.

This creates a predictable user experience:

- if the user was last active in the CLI, codebase-oriented read tools go to the CLI
- if the user was last active in the web app, Phoenix UI-oriented tools go to the web runtime

### Fallback Behavior

If `last_touched_surface` cannot satisfy the tool call:

1. choose another eligible attached runtime if one exists
2. otherwise use a server-owned executor if the tool supports it
3. otherwise fail the tool call with a typed unavailable result

### Dispatch Inputs

The dispatcher should consider:

- logical tool eligibility
- runtime attachment status
- last touched surface
- required context availability
- trust / policy constraints

## Context Model

### Typed Context Contributions

Each runtime declares which context artifacts it can produce and may push updates into the session as the user interacts with that surface.

Examples:

- web runtime contributes current page, selected entities, filters, and time range
- CLI runtime contributes repo root, workspace shape, git status, and framework detection

### Stale Context

Context should not disappear simply because a runtime disconnects.

Instead, it should be marked stale and remain available to PXI with explicit freshness metadata so the model and tools can reason about its trustworthiness.

This enables the same session to move between surfaces while preserving continuity.

### Context Exposure To The Model

The model should see a structured projection of currently relevant context plus freshness information. The exact projection format is intentionally undecided.

Open design question:

- whether raw context artifacts are stored and exposed directly
- whether some artifacts should be normalized, summarized, or transformed before model exposure

## Runtime Capability Negotiation

When a runtime attaches to a session, it performs a capability declaration handshake.

The runtime declares:

- which logical tools it can execute
- which context artifacts it can produce
- any runtime-specific policy or limits

The server records those declarations and recomputes the session's available capability surface.

This allows one session to gain or lose abilities as runtimes attach and detach.

## Interface Model

### Web

The web interface is a PXI runtime surface that specializes in Phoenix UI context and interactive user experience.

Typical strengths:

- current Phoenix page context
- selected trace / span / project context
- ask-user interactions
- rich rendered chat and trace linking

### CLI

The CLI is a PXI runtime surface that specializes in real local workspace inspection.

Typical strengths:

- repository-aware read-only inspection
- local file and codebase analysis
- framework and environment detection
- terminal-oriented user flows

### Future MCP / IDE Surfaces

The architecture should allow additional Phoenix-owned runtime gateways for surfaces such as Claude Code or Codex, but these remain adapters onto the same PXI session model rather than new session types.

## Handoff Model

"Open in CLI" should attach a CLI runtime to the existing session rather than fork or export a new one.

Desired properties:

- same session id
- same event log
- same message history
- same pending context inventory
- new runtime attachment for the CLI
- `last_touched_surface` updated when the user becomes active in CLI

The session remains canonical while the runtime surface changes.

## Message Submission Model

When a surface submits a user message:

1. the server verifies the session is not already processing a turn
2. the server records the submitting surface as `last_touched_surface`
3. the server appends a user message event
4. the orchestrator runs the model turn
5. tools are dispatched through runtime gateways as needed
6. final assistant output is appended to the same session

Messages submitted during an active turn are rejected.

## Policy And Trust

This architecture assumes executor-aware trust boundaries.

Examples:

- some tools may be read-only everywhere
- some tools may be available only on specific runtimes
- some tools may require richer context before they become eligible

For the initial target, the emphasis is on read-only inspect/suggest flows rather than autonomous file mutation.

## Observability

Observability should extend beyond individual chat turns to the full PXI session lifecycle.

The architecture should capture:

- session-level identity
- runtime attachment and detachment events
- tool dispatch destination
- context freshness and staleness
- turn boundaries
- tool results across surfaces

This should make a multi-surface PXI session observable as one coherent runtime, not a set of unrelated chats.

## API Surface

The concrete transport is undecided, but the architecture requires APIs or RPC endpoints for at least:

- create session
- attach runtime
- detach runtime
- declare runtime capabilities
- push context artifact updates
- submit user message
- stream assistant turn
- dispatch tool request to runtime
- return tool result from runtime
- inspect session state

The internal PXI model should remain Phoenix-native even if some runtime integrations use MCP-compatible adapters.

## Open Questions

- How should raw context artifacts be transformed before model exposure?
- Which context kinds should expire automatically versus remain stale indefinitely?
- What is the exact ranking policy when `last_touched_surface` is unavailable?
- Which logical tools, if any, should always execute on the server even when client runtimes are attached?
- How much of the event log should be projected back to users versus kept internal?

## Target Outcome

PXI becomes a single server-centric agent runtime that users can move between Phoenix surfaces without losing continuity.

The web app, CLI, and future Phoenix-owned integrations all become attached runtimes that contribute typed context and satisfy typed tool calls within one canonical session.

This architecture establishes the foundation for a coherent multi-surface PXI product without requiring separate agent implementations per interface.
