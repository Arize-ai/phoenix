import { useCallback, useMemo, useRef, useState } from "react";

import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import {
  getUnboundRequiredVariables,
  type ProjectEvaluatorTarget,
  toEvaluatorRecordKind,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import type { EvaluatorStoreInstance } from "@phoenix/store/evaluatorStore";
import type { EvaluatorInputMapping } from "@phoenix/types";

/**
 * How long a submit waits for the filter field to finish validating. The
 * field reports invalid until the server answers, which includes the moment
 * right after PXI sets a filter and remounts it.
 */
export const FILTER_VALIDITY_SETTLE_TIMEOUT_MS = 3_000;

/** The filter field's validity, as the form tracks it. */
export type ProjectEvaluatorFilterValidity = {
  /** False while the filter does not parse, or is still being validated. */
  isFilterValid: boolean;
  onFilterValidityChange: (isValid: boolean) => void;
  /**
   * Resolves true as soon as the filter is valid, or with its validity once
   * the settle timeout passes.
   */
  waitForValidFilter: () => Promise<boolean>;
};

/** Tracks the filter field's validity for the gate. */
export function useProjectEvaluatorFilterValidity(): ProjectEvaluatorFilterValidity {
  const [isFilterValid, setIsFilterValid] = useState(true);
  // The latest report, outside render, so a submit that runs before the next
  // render reads it.
  const latestRef = useRef(true);
  const waitersRef = useRef(new Set<() => void>());
  const onFilterValidityChange = useCallback((isValid: boolean) => {
    latestRef.current = isValid;
    setIsFilterValid(isValid);
    if (isValid) {
      for (const resolveWaiter of waitersRef.current) {
        resolveWaiter();
      }
      waitersRef.current.clear();
    }
  }, []);
  const waitForValidFilter = useCallback(
    () =>
      latestRef.current
        ? Promise.resolve(true)
        : new Promise<boolean>((resolve) => {
            const resolveWaiter = () => {
              clearTimeout(timeout);
              resolve(true);
            };
            const timeout = setTimeout(() => {
              waitersRef.current.delete(resolveWaiter);
              resolve(latestRef.current);
            }, FILTER_VALIDITY_SETTLE_TIMEOUT_MS);
            waitersRef.current.add(resolveWaiter);
          }),
    []
  );
  return useMemo(
    () => ({ isFilterValid, onFilterValidityChange, waitForValidFilter }),
    [isFilterValid, onFilterValidityChange, waitForValidFilter]
  );
}

/**
 * What a project evaluator form's save button depends on, apart from the
 * fields it validates on press. The button and PXI's submit read the same
 * gate, so PXI cannot save what the human could not.
 */
export type ProjectEvaluatorSubmitGateInput = {
  targetType: ProjectEvaluatorTarget;
  filterValidity: Pick<
    ProjectEvaluatorFilterValidity,
    "isFilterValid" | "waitForValidFilter"
  >;
  variables: readonly string[];
  /** The variables that must resolve; every variable when omitted. */
  requiredVariables?: readonly string[];
  /** The verb the button's hint uses, e.g. "create", "save", "attach". */
  submitLabel: string;
  /** How an agent maps an input on this form, named in its refusal. */
  mapWith?: string;
  /** Why the form cannot save yet for some other reason, e.g. still loading. */
  pendingReason?: string | null;
};

export type ProjectEvaluatorSubmitGate = {
  isSubmitDisabled: boolean;
  /** Shown beside the disabled button. */
  submitHint?: string;
  /** Why a submit is refused, worded for an agent; null while it may save. */
  blocker: string | null;
};

const DEFAULT_MAP_WITH = "a set_input_mapping edit";

/** How an agent maps an input on an attach form. */
export const ATTACH_MAP_WITH = "evaluators.project.attach.edit";

/** The gate for the form as it is, given the mapping in its store. */
export function getProjectEvaluatorSubmitGate({
  targetType,
  isFilterValid,
  variables,
  requiredVariables,
  submitLabel,
  mapWith = DEFAULT_MAP_WITH,
  pendingReason,
  inputMapping,
}: Omit<ProjectEvaluatorSubmitGateInput, "filterValidity"> & {
  isFilterValid: boolean;
  inputMapping: EvaluatorInputMapping;
}): ProjectEvaluatorSubmitGate {
  const recordKind = toEvaluatorRecordKind(targetType);
  if (pendingReason) {
    return {
      isSubmitDisabled: true,
      blocker: `Not saved: ${pendingReason}`,
    };
  }
  if (!isFilterValid) {
    return {
      isSubmitDisabled: true,
      submitHint: `Fix the ${recordKind} filter to ${submitLabel}`,
      blocker:
        `Not saved: the ${recordKind} filter in the form is invalid, so ` +
        `the form's ${submitLabel} button is disabled. Set a valid ` +
        "filterCondition with evaluators.project.scope.edit (or ask the " +
        "human to fix the filter field), then submit again.",
    };
  }
  const unbound = getUnboundRequiredVariables({
    variables,
    requiredVariables,
    inputMapping,
  });
  if (unbound.length > 0) {
    const names = unbound.join(", ");
    return {
      isSubmitDisabled: true,
      submitHint: `Map ${names} to ${submitLabel}`,
      blocker:
        `Not saved: the form's ${submitLabel} button is disabled because ` +
        `${names} ${unbound.length === 1 ? "has" : "have"} no input mapping. ` +
        `Map ${unbound.length === 1 ? "it" : "each"} to a path on the ` +
        `${recordKind} (or a literal) with ${mapWith}, then submit again.`,
    };
  }
  return { isSubmitDisabled: false, blocker: null };
}

/** The refusal a blocked submit resolves with, or null when it may save. */
export async function getProjectEvaluatorSubmitRefusal({
  gate: { filterValidity, ...gate },
  store,
}: {
  gate: ProjectEvaluatorSubmitGateInput;
  store: EvaluatorStoreInstance;
}): Promise<{ ok: false; error: string } | null> {
  // A filter PXI just set is still being validated; the human would wait for
  // the button to enable, so the submit waits too.
  const isFilterValid = await filterValidity.waitForValidFilter();
  // The mapping is read now rather than from the last render, so a mapping
  // PXI set just before submitting counts.
  const { blocker } = getProjectEvaluatorSubmitGate({
    ...gate,
    isFilterValid,
    inputMapping: store.getState().evaluator.inputMapping,
  });
  return blocker ? { ok: false, error: blocker } : null;
}

/**
 * The gate the save button renders with. Must be called under an
 * `EvaluatorStoreProvider`.
 */
export function useProjectEvaluatorSubmitGate({
  filterValidity,
  ...gate
}: ProjectEvaluatorSubmitGateInput): ProjectEvaluatorSubmitGate {
  const inputMapping = useEvaluatorStore(
    (state) => state.evaluator.inputMapping
  );
  return getProjectEvaluatorSubmitGate({
    ...gate,
    isFilterValid: filterValidity.isFilterValid,
    inputMapping,
  });
}
