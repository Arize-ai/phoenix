import { fetchQuery, graphql } from "relay-runtime";

import environment from "@phoenix/RelayEnvironment";

import type { spanFilterValidationQuery } from "./__generated__/spanFilterValidationQuery.graphql";
import { isKnownRootSpanCondition } from "./spanFilterRootScopeConstants";

export type SpanFilterConditionValidation = {
  isValid: boolean;
  errorMessage?: string | null;
  /**
   * Whether the condition restricts the result set to root spans, which
   * decides between cumulative and per-span metric columns. `null` when the
   * server did not answer; `false` means the condition is not *known* to be
   * root-scoped, which is not the same as knowing it admits non-root spans.
   */
  selectsRootSpansOnly: boolean | null;
};

const MAX_VALIDATION_CACHE_ENTRIES = 100;
const validationCache = new Map<
  string,
  Promise<SpanFilterConditionValidation>
>();

function validationCacheKey(projectId: string, condition: string) {
  return JSON.stringify([projectId, condition]);
}

function readCachedValidation(key: string) {
  const cached = validationCache.get(key);
  if (cached) {
    // Refresh insertion order so the least recently used entry is evicted.
    validationCache.delete(key);
    validationCache.set(key, cached);
  }
  return cached;
}

function cacheValidation(
  key: string,
  validation: Promise<SpanFilterConditionValidation>
) {
  validationCache.set(key, validation);
  if (validationCache.size > MAX_VALIDATION_CACHE_ENTRIES) {
    const leastRecentlyUsedKey = validationCache.keys().next().value;
    if (leastRecentlyUsedKey !== undefined) {
      validationCache.delete(leastRecentlyUsedKey);
    }
  }
}

/**
 * Async server-side validation of a span filter condition expression, together
 * with the structural facts a caller needs about that same condition. Both are
 * questions about the parsed expression, so neither can be answered here
 * without a second parser for the DSL.
 *
 * Lives in its own file (rather than co-located with `SpanFilterConditionField`)
 * so both the field's deferred-validation effect and the
 * `SpanFiltersProvider`'s agent client-action handler can call it without
 * creating a circular import between the field and the provider.
 */
export async function validateSpanFilterCondition(
  condition: string,
  projectId: string
): Promise<SpanFilterConditionValidation> {
  if (!condition) {
    // An empty condition restricts nothing, so it is knowably not root-scoped
    // without asking.
    return {
      isValid: true,
      errorMessage: null,
      selectsRootSpansOnly: false,
    };
  }
  if (isKnownRootSpanCondition(condition)) {
    // Both answers are already known for a predicate this app wrote. Skipping
    // the request also removes a failure mode: a transport error here would
    // flag the default spans view as invalid over a condition that cannot be.
    return {
      isValid: true,
      errorMessage: null,
      selectsRootSpansOnly: true,
    };
  }
  const cacheKey = validationCacheKey(projectId, condition);
  const cachedValidation = readCachedValidation(cacheKey);
  if (cachedValidation) {
    return cachedValidation;
  }

  const validation = fetchQuery<spanFilterValidationQuery>(
    environment,
    graphql`
      query spanFilterValidationQuery($condition: String!, $id: ID!) {
        project: node(id: $id) {
          ... on Project {
            validateSpanFilterCondition(condition: $condition) {
              isValid
              errorMessage
            }
            analyzeSpanFilterCondition(condition: $condition) {
              selectsRootSpansOnly
            }
          }
        }
      }
    `,
    { condition, id: projectId }
  )
    .toPromise()
    .then((validationResult) => {
      if (!validationResult) {
        throw new Error("Filter condition validation is null");
      }
      // Both fields are optional on the inline fragment, since `node` need not
      // be a Project. A missing validation reads as invalid.
      const { project } = validationResult;
      return {
        isValid: project.validateSpanFilterCondition?.isValid ?? false,
        errorMessage: project.validateSpanFilterCondition?.errorMessage ?? null,
        selectsRootSpansOnly:
          project.analyzeSpanFilterCondition?.selectsRootSpansOnly ?? null,
      };
    });
  cacheValidation(cacheKey, validation);
  void validation.catch(() => {
    // A transport failure is not a validation answer. Remove only this promise
    // so a later attempt can retry even if the key has since been replaced.
    if (validationCache.get(cacheKey) === validation) {
      validationCache.delete(cacheKey);
    }
  });
  return validation;
}
