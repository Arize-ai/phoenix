# Page Context Refactor Plan

This document describes a follow-up refactor for the current agent filesystem implementation. It is intended to be executable by another agent working on top of the current uncommitted changes in the tree.

## Why this refactor exists

The current implementation proves out the core idea of a page-scoped `/phoenix` filesystem snapshot, but `app/src/agent/context/adapters/pageContextAdapter.ts` currently mixes together several different responsibilities:

- the durable page-context model
- transport-specific data fetching
- GraphQL query definitions
- response normalization
- filesystem materialization
- adapter selection/orchestration

That makes the code harder to review and harder to evolve. We want to separate the long-lived abstraction from the experimental extraction mechanism.

## Architectural goals

There are two explicit goals for the refactor:

1. The concept of a page context is durable and should remain rock solid and easy to understand over time.
2. The GraphQL transport is experimental and should be isolated so other transports can be spiked later, such as REST or Relay store extraction, without changing the page-context model.

## Important current-state context

This work should be done on top of the current working changes already present in the repo.

Those current changes already implement:

- browser bash runtime safety and instrumentation
- model-facing bash sandbox capability text
- route/time-range derived page context
- page-scoped `/phoenix` snapshot generation for `generic`, `project`, and `trace` pages
- automatic refresh on navigation and time-range changes
- `/refresh` chat command support
- verification for project/trace context injection and filesystem safety

The current implementation is functionally valuable. This refactor should preserve behavior while improving structure.

## Preserve these behavioral invariants

Do not change these unless there is a strong reason and the caller code is updated intentionally:

- `/phoenix/**` remains page-scoped context, not a cross-page cache.
- navigation and `/refresh` overwrite `/phoenix/**` in place.
- `/home/user/workspace/**` persists per agent session.
- the page-context feature remains the default context strategy.
- project and trace page behavior remains functionally equivalent after the refactor.
- GraphQL remains the default data source for now, but it should become visibly experimental in code structure.

## Target architecture

Refactor the current implementation into three layers:

1. Durable page-context model
2. Durable filesystem materialization
3. Experimental data sources / transports

The central design rule is:

- page context defines what snapshot should exist
- source defines how raw data is obtained
- materializer defines how normalized data is written into `/phoenix`

## Target directory structure

This is the proposed target shape. Exact filenames can vary slightly if needed, but keep the separation clear.

```text
app/src/agent/context/
  pageContext.ts
  pageContextTypes.ts
  refreshAgentContext.ts

  materializers/
    index.ts
    materializePageContext.ts
    genericPageMaterializer.ts
    projectPageMaterializer.ts
    tracePageMaterializer.ts
    shared.ts

  sources/
    index.ts
    types.ts
    __experimental__/
      graphql/
        graphqlPageContextSource.ts
        graphqlPageContextQueries.ts
        graphqlPageContextTypes.ts
        graphqlTransport.ts
```

## Layer responsibilities

### 1. Durable page-context model

This layer should remain easy to explain to humans and other agents.

It should own:

- `AgentPageContext`
- `AgentPageKind`
- `AgentContextRefreshReason`
- route-derived ids like `projectId` and `traceId`
- page-context signature logic
- any transport-independent normalized data contracts

It should not know anything about:

- GraphQL query strings
- `authFetch`
- Relay store internals
- REST endpoint details

Recommended files:

- `pageContextTypes.ts` for stable shared types
- `pageContext.ts` for route parsing / page-kind derivation

### 2. Durable filesystem materialization

This layer should take a normalized page-context payload and convert it into `/phoenix` files.

It should own:

- `project.json`, `trace.json`, `tree.json`
- `INDEX.json`
- `_schema.json`
- manifest and metadata assembly
- lazy vs eager file generation decisions

It should not know anything about:

- GraphQL transport
- network fetches
- raw GraphQL response shapes

Recommended files:

- `materializePageContext.ts` for routing to the right materializer
- `projectPageMaterializer.ts`
- `tracePageMaterializer.ts`
- `genericPageMaterializer.ts`
- `shared.ts` for metadata/manifest/skeleton helpers

### 3. Experimental sources / transports

This layer should load page data and normalize it into a transport-independent shape.

For now, the GraphQL source should live at:

- `app/src/agent/context/sources/__experimental__/graphql/`

It should own:

- GraphQL query strings
- `authFetch` use
- GraphQL response typing
- mapping GraphQL responses into normalized page-context data

It should be clearly experimental in naming and directory structure.

## Key interface to introduce

Introduce a transport-independent `PageContextData` union in `app/src/agent/context/sources/types.ts`.

This is the contract between experimental sources and durable materializers.

Example shape:

```ts
export type PageContextData =
  | {
      pageKind: "generic";
    }
  | {
      pageKind: "project";
      project: ProjectSummary;
      traces: ProjectTraceRow[];
      spans: ProjectSpanRow[];
      sessions: ProjectSessionRow[];
    }
  | {
      pageKind: "trace";
      project: {
        id: string;
        name: string;
      };
      trace: TraceSummary;
      spans: TraceSpanRow[];
    };

export interface PageContextSource {
  id: string;
  load(context: AgentPageContext): Promise<PageContextData>;
}
```

The exact fields can differ, but the important rule is:

- materializers consume `PageContextData`
- sources produce `PageContextData`
- materializers do not consume raw GraphQL responses

## Proposed top-level flow after refactor

The orchestration should become simple enough to explain in a few lines:

1. Build `AgentPageContext` from route/time-range state.
2. Select the default page-context source.
3. Load normalized `PageContextData` from that source.
4. Materialize `PageContextData` into an `AdapterResult`.
5. Write the resulting files into `/phoenix`.

That means `generatePageContextFiles(...)` should become small and orchestration-only.

Ideal target shape:

```ts
export async function generatePageContextFiles(...) {
  const source = getDefaultPageContextSource();
  const data = await source.load(pageContext);
  return materializePageContext({
    pageContext,
    refreshReason,
    data,
  });
}
```

## Concrete refactor steps

### Step 1: Extract durable page-context types

- Move stable type definitions out of `app/src/agent/context/adapters/types.ts` into a more durable home such as `app/src/agent/context/pageContextTypes.ts`.
- Keep adapter-specific contracts only where they are still genuinely adapter-specific.
- Update imports incrementally rather than with a giant rename at the end.

Suggested durable types to move or define clearly:

- `AgentContextRefreshReason`
- `AgentPageKind`
- `AgentTimeRangeContext`
- `AgentPageContext`
- metadata types if they are part of the durable page-context contract

### Step 2: Extract source contracts

- Add `app/src/agent/context/sources/types.ts`.
- Define `PageContextData` and `PageContextSource` there.
- Keep this file transport-agnostic.

### Step 3: Extract GraphQL transport into `sources/__experimental__/graphql`

- Move GraphQL query strings out of `pageContextAdapter.ts`.
- Move `fetchContextQuery(...)` out of `pageContextAdapter.ts`.
- Move GraphQL response-only types out of `pageContextAdapter.ts`.
- Implement a `graphqlPageContextSource` that:
  - receives `AgentPageContext`
  - selects the necessary queries
  - fetches and normalizes data
  - returns `PageContextData`

Recommended file roles:

- `graphqlPageContextQueries.ts`: query strings only
- `graphqlTransport.ts`: low-level GraphQL POST helper around `authFetch`
- `graphqlPageContextTypes.ts`: GraphQL-response-only local types
- `graphqlPageContextSource.ts`: source implementation and normalization

### Step 4: Extract durable materializers

- Move project filesystem creation into `projectPageMaterializer.ts`.
- Move trace filesystem creation into `tracePageMaterializer.ts`.
- Move generic fallback generation into `genericPageMaterializer.ts`.
- Move shared metadata/manifest/skeleton helpers into `materializers/shared.ts`.

Each materializer should accept stable normalized data, not perform fetches.

Example direction:

- `materializeProjectPageContext({ pageContext, refreshReason, data })`
- `materializeTracePageContext({ pageContext, refreshReason, data })`
- `materializeGenericPageContext({ pageContext, refreshReason })`

### Step 5: Shrink `pageContextAdapter.ts` into orchestration-only code

The current `pageContextAdapter.ts` should either:

- become a small orchestrator, or
- be replaced by `materializers/materializePageContext.ts` plus a small public entrypoint

In either case, it should no longer contain:

- GraphQL query strings
- raw GraphQL transport logic
- large response type blocks

### Step 6: Keep the external behavior unchanged

After the refactor, these should still pass and still behave the same:

- project page context injection
- trace page context injection
- auto refresh on navigation
- auto refresh on time-range changes
- `/refresh` behavior
- `/phoenix` write denial
- workspace persistence
- instrumented bash tool calling

## Naming guidance

Use names that emphasize durability vs experimentation.

Preferred durable concepts:

- `pageContext`
- `materializer`
- `snapshot`

Preferred experimental concepts:

- `source`
- `transport`
- `__experimental__/graphql`

Avoid using `adapter` to mean both transport and filesystem materialization. The durable thing is the page-context snapshot model, not the transport implementation.

## Why this structure helps future work

This refactor is specifically meant to make future experiments easier.

Once complete, it should be straightforward to add:

- `sources/__experimental__/rest/restPageContextSource.ts`
- `sources/__experimental__/relay-store/relayStorePageContextSource.ts`

Those sources should be able to produce the same `PageContextData` contract without changing the materializers.

This will also help the upcoming dataset/experiment work, because support for new page kinds should become:

1. add a new `pageKind` and route parsing if needed
2. add normalized `PageContextData` support
3. add a new materializer
4. teach one or more sources how to load that data

## Verification checklist

After refactoring, run at least:

- `make lint-frontend`
- `make typecheck-frontend`
- `pnpm test -- agent/chat/__tests__/buildAgentChatRequestBody.test.ts agent/chat/__tests__/handleAgentToolCall.test.ts agent/context/__tests__/refreshAgentContext.test.ts`

Also do a quick manual sanity pass if possible:

- open a project page and inspect `/phoenix`
- open a trace page and inspect `/phoenix`
- verify `/refresh`
- verify time-range refresh

## Non-goals for this refactor

Do not combine this refactor with the dataset/experiment implementation unless there is a compelling reason. That follow-up work is already tracked separately in `internal_docs/agent-filesystem/tasks.md`.

Also do not change the current default behavior of overwriting `/phoenix/**` on navigation. That is intentional.

## Expected end state

By the end of this refactor, a reviewer should be able to answer these questions quickly:

- What is the durable page-context model?
- What data shape do materializers consume?
- Where does the GraphQL experiment live?
- How would we add a REST or Relay source without changing the filesystem contract?
- Which modules are stable and which are explicitly provisional?

If those answers are not obvious from the code layout, the refactor is not complete.
