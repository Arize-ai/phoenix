import { describe, expect, it } from "vitest";

import type { SpanFilterSeed } from "../spanFilterSeed";
import {
  createSpanFilterSeedLoadState,
  spanFilterSeedLoadReducer,
  type SpanFilterSeedLoadAction,
  type SpanFilterSeedLoadState,
} from "../spanFilterSeedLoadState";

const CUSTOM_CONDITION = "status_code == 'ERROR'";
const customSeed: SpanFilterSeed = {
  condition: CUSTOM_CONDITION,
  requiresServerValidation: true,
};

function reduce(
  state: SpanFilterSeedLoadState,
  ...actions: SpanFilterSeedLoadAction[]
) {
  return actions.reduce(spanFilterSeedLoadReducer, state);
}

function failedCustomSeedRequest() {
  return reduce(
    createSpanFilterSeedLoadState(customSeed),
    {
      type: "validationSucceeded",
      condition: CUSTOM_CONDITION,
      rootSpansOnly: false,
    },
    {
      type: "requestStarted",
      requestId: 1,
      query: { condition: CUSTOM_CONDITION, rootSpansOnly: false },
    },
    {
      type: "requestCompleted",
      requestId: 1,
      query: { condition: CUSTOM_CONDITION, rootSpansOnly: false },
      error: new Error("network failed"),
    }
  );
}

describe("spanFilterSeedLoadReducer", () => {
  it("starts a custom seed unresolved with the provisional rows hidden", () => {
    expect(createSpanFilterSeedLoadState(customSeed)).toMatchObject({
      appliedQuery: { condition: "", rootSpansOnly: false },
      loadedQuery: { condition: "", rootSpansOnly: false },
      resolvedSeedQuery: null,
      isSeedSettled: false,
      seedError: null,
    });
  });

  it("settles only after the resolved seed query loads successfully", () => {
    const query = { condition: CUSTOM_CONDITION, rootSpansOnly: true };
    const state = reduce(
      createSpanFilterSeedLoadState(customSeed),
      {
        type: "validationSucceeded",
        condition: query.condition,
        rootSpansOnly: query.rootSpansOnly,
      },
      { type: "requestStarted", requestId: 1, query },
      {
        type: "requestCompleted",
        requestId: 1,
        query,
        error: null,
      }
    );

    expect(state).toMatchObject({
      appliedQuery: query,
      loadedQuery: query,
      resolvedSeedQuery: query,
      isSeedSettled: true,
      seedError: null,
    });
  });

  it("retries the same resolved condition after its request fails", () => {
    const failedState = failedCustomSeedRequest();
    expect(failedState).toMatchObject({
      isSeedSettled: false,
      seedError: { kind: "refetch", message: expect.any(String) },
      retryVersion: 0,
    });

    const retryState = spanFilterSeedLoadReducer(failedState, {
      type: "validationSucceeded",
      condition: CUSTOM_CONDITION,
      rootSpansOnly: false,
    });

    expect(retryState).toMatchObject({
      isSeedSettled: false,
      seedError: null,
      retryVersion: 1,
    });
  });

  it("waits for an unfiltered retry when cleared after failure", () => {
    const clearedState = spanFilterSeedLoadReducer(failedCustomSeedRequest(), {
      type: "validationSucceeded",
      condition: "",
      rootSpansOnly: false,
    });

    expect(clearedState).toMatchObject({
      appliedQuery: { condition: "", rootSpansOnly: false },
      resolvedSeedQuery: { condition: "", rootSpansOnly: false },
      isSeedSettled: false,
      seedError: null,
    });

    const loadedState = reduce(
      clearedState,
      {
        type: "requestStarted",
        requestId: 2,
        query: { condition: "", rootSpansOnly: false },
      },
      {
        type: "requestCompleted",
        requestId: 2,
        query: { condition: "", rootSpansOnly: false },
        error: null,
      }
    );
    expect(loadedState.isSeedSettled).toBe(true);
  });

  it("settles immediately when validation resolves to provisional rows", () => {
    const state = spanFilterSeedLoadReducer(
      createSpanFilterSeedLoadState(customSeed),
      {
        type: "validationSucceeded",
        condition: "",
        rootSpansOnly: false,
      }
    );

    expect(state.isSeedSettled).toBe(true);
  });

  it("settles an invalid seed without loading filtered rows", () => {
    const state = spanFilterSeedLoadReducer(
      createSpanFilterSeedLoadState(customSeed),
      { type: "validationRejected" }
    );

    expect(state).toMatchObject({
      appliedQuery: { condition: "", rootSpansOnly: false },
      resolvedSeedQuery: null,
      isSeedSettled: true,
    });
  });

  it("keeps provisional rows hidden when validation transport fails", () => {
    const state = spanFilterSeedLoadReducer(
      createSpanFilterSeedLoadState(customSeed),
      { type: "validationErrored" }
    );

    expect(state).toMatchObject({
      resolvedSeedQuery: null,
      isSeedSettled: false,
      seedError: { kind: "validation", message: expect.any(String) },
    });
  });

  it("retries validation without settling provisional rows", () => {
    const failedState = spanFilterSeedLoadReducer(
      createSpanFilterSeedLoadState(customSeed),
      { type: "validationErrored" }
    );
    const retryState = spanFilterSeedLoadReducer(failedState, {
      type: "retryRequested",
    });

    expect(retryState).toMatchObject({
      isSeedSettled: false,
      seedError: null,
      validationRetryVersion: 1,
    });
  });

  it("retries a failed filtered refetch without editing the condition", () => {
    const retryState = spanFilterSeedLoadReducer(failedCustomSeedRequest(), {
      type: "retryRequested",
    });

    expect(retryState).toMatchObject({
      isSeedSettled: false,
      seedError: null,
      retryVersion: 1,
    });
  });

  it("does not let a provisional refetch settle unresolved validation", () => {
    const query = { condition: "", rootSpansOnly: false };
    const state = reduce(
      createSpanFilterSeedLoadState(customSeed),
      { type: "requestStarted", requestId: 1, query },
      {
        type: "requestCompleted",
        requestId: 1,
        query,
        error: null,
      }
    );

    expect(state).toMatchObject({
      resolvedSeedQuery: null,
      isSeedSettled: false,
      latestSuccessfulRequestId: 1,
    });
  });

  it("ignores completion from an obsolete request", () => {
    const query = { condition: CUSTOM_CONDITION, rootSpansOnly: false };
    const state = reduce(
      createSpanFilterSeedLoadState(customSeed),
      {
        type: "validationSucceeded",
        condition: query.condition,
        rootSpansOnly: query.rootSpansOnly,
      },
      { type: "requestStarted", requestId: 1, query },
      { type: "requestStarted", requestId: 2, query },
      {
        type: "requestCompleted",
        requestId: 1,
        query,
        error: null,
      }
    );

    expect(state).toMatchObject({
      latestRequestId: 2,
      isSeedSettled: false,
      loadedQuery: { condition: "", rootSpansOnly: false },
    });
  });
});
