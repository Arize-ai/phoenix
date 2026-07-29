import type { SpanFilterSeed } from "./spanFilterSeed";

export type SpanFilterQuery = {
  condition: string;
  rootSpansOnly: boolean;
};

export type SpanFilterSeedLoadState = {
  appliedQuery: SpanFilterQuery;
  loadedQuery: SpanFilterQuery;
  resolvedSeedQuery: SpanFilterQuery | null;
  isSeedSettled: boolean;
  seedError: {
    kind: "validation" | "refetch";
    message: string;
  } | null;
  retryVersion: number;
  validationRetryVersion: number;
  latestRequestId: number;
  latestSuccessfulRequestId: number;
};

export type SpanFilterSeedLoadAction =
  | {
      type: "validationSucceeded";
      condition: string;
      rootSpansOnly: boolean | null;
    }
  | { type: "validationRejected" }
  | { type: "validationErrored" }
  | { type: "retryRequested" }
  | {
      type: "requestStarted";
      requestId: number;
      query: SpanFilterQuery;
    }
  | {
      type: "requestCompleted";
      requestId: number;
      query: SpanFilterQuery;
      error: Error | null;
    };

const UNFILTERED_QUERY: SpanFilterQuery = {
  condition: "",
  rootSpansOnly: false,
};

function queriesMatch(left: SpanFilterQuery, right: SpanFilterQuery) {
  return (
    left.condition === right.condition &&
    left.rootSpansOnly === right.rootSpansOnly
  );
}

export function createSpanFilterSeedLoadState(
  seed: SpanFilterSeed
): SpanFilterSeedLoadState {
  if (seed.requiresServerValidation) {
    return {
      appliedQuery: UNFILTERED_QUERY,
      loadedQuery: UNFILTERED_QUERY,
      resolvedSeedQuery: null,
      isSeedSettled: false,
      seedError: null,
      retryVersion: 0,
      validationRetryVersion: 0,
      latestRequestId: 0,
      latestSuccessfulRequestId: 0,
    };
  }
  const query = {
    condition: seed.condition,
    rootSpansOnly: seed.rootSpansOnly,
  };
  return {
    appliedQuery: query,
    loadedQuery: query,
    resolvedSeedQuery: query,
    isSeedSettled: true,
    seedError: null,
    retryVersion: 0,
    validationRetryVersion: 0,
    latestRequestId: 0,
    latestSuccessfulRequestId: 0,
  };
}

export function spanFilterSeedLoadReducer(
  state: SpanFilterSeedLoadState,
  action: SpanFilterSeedLoadAction
): SpanFilterSeedLoadState {
  switch (action.type) {
    case "validationSucceeded": {
      const resolvedQuery = {
        condition: action.condition,
        rootSpansOnly: action.rootSpansOnly ?? state.appliedQuery.rootSpansOnly,
      };
      if (state.isSeedSettled) {
        if (queriesMatch(state.appliedQuery, resolvedQuery)) {
          return state;
        }
        return { ...state, appliedQuery: resolvedQuery };
      }
      const loadedQueryMatches =
        state.seedError === null &&
        queriesMatch(state.loadedQuery, resolvedQuery);
      const appliedQueryMatches = queriesMatch(
        state.appliedQuery,
        resolvedQuery
      );
      return {
        ...state,
        appliedQuery: resolvedQuery,
        resolvedSeedQuery: resolvedQuery,
        isSeedSettled: loadedQueryMatches,
        seedError: null,
        // If validation resolves to the already-applied query after a failed
        // request, no applied-query dependency changes. Advance an explicit
        // retry token so the table issues the request again.
        retryVersion:
          !loadedQueryMatches && appliedQueryMatches
            ? state.retryVersion + 1
            : state.retryVersion,
      };
    }
    case "validationRejected":
      return state.isSeedSettled
        ? state
        : {
            ...state,
            isSeedSettled: true,
            seedError: null,
          };
    case "validationErrored":
      return state.isSeedSettled
        ? state
        : {
            ...state,
            seedError: {
              kind: "validation",
              message:
                "The filter condition could not be validated, so the table has not been updated.",
            },
          };
    case "retryRequested":
      if (state.isSeedSettled || state.seedError === null) {
        return state;
      }
      return state.seedError.kind === "validation"
        ? {
            ...state,
            seedError: null,
            validationRetryVersion: state.validationRetryVersion + 1,
          }
        : {
            ...state,
            seedError: null,
            retryVersion: state.retryVersion + 1,
          };
    case "requestStarted":
      return {
        ...state,
        latestRequestId: action.requestId,
        seedError:
          !state.isSeedSettled &&
          state.resolvedSeedQuery !== null &&
          queriesMatch(state.resolvedSeedQuery, action.query)
            ? null
            : state.seedError,
      };
    case "requestCompleted": {
      if (action.requestId !== state.latestRequestId) {
        return state;
      }
      const completesResolvedSeed =
        !state.isSeedSettled &&
        state.resolvedSeedQuery !== null &&
        queriesMatch(state.resolvedSeedQuery, action.query);
      if (action.error) {
        return completesResolvedSeed
          ? {
              ...state,
              seedError: {
                kind: "refetch",
                message: "The filtered spans could not be loaded.",
              },
            }
          : state;
      }
      return {
        ...state,
        loadedQuery: action.query,
        latestSuccessfulRequestId: action.requestId,
        isSeedSettled: completesResolvedSeed || state.isSeedSettled,
        seedError: completesResolvedSeed ? null : state.seedError,
      };
    }
  }
  return state;
}
