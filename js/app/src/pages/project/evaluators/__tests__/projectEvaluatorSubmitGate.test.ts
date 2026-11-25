import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";

import {
  FILTER_VALIDITY_SETTLE_TIMEOUT_MS,
  getProjectEvaluatorSubmitGate,
  type ProjectEvaluatorFilterValidity,
  useProjectEvaluatorFilterValidity,
} from "@phoenix/pages/project/evaluators/projectEvaluatorSubmitGate";

const unmapped = { pathMapping: {}, literalMapping: {} };

describe("getProjectEvaluatorSubmitGate", () => {
  it("opens once every required non-slot input is mapped", () => {
    expect(
      getProjectEvaluatorSubmitGate({
        targetType: "SPAN",
        isFilterValid: true,
        variables: ["input", "output", "context"],
        submitLabel: "create",
        inputMapping: {
          pathMapping: {},
          literalMapping: { context: "none" },
        },
      })
    ).toEqual({ isSubmitDisabled: false, blocker: null });
  });

  it("names the unmapped inputs and how to map them", () => {
    const gate = getProjectEvaluatorSubmitGate({
      targetType: "TRACE",
      isFilterValid: true,
      variables: ["context", "reference", "optional_note"],
      requiredVariables: ["context", "reference"],
      submitLabel: "attach",
      mapWith: "evaluators.project.attach.edit",
      inputMapping: unmapped,
    });
    expect(gate.isSubmitDisabled).toBe(true);
    expect(gate.submitHint).toBe("Map context, reference to attach");
    expect(gate.blocker).toContain("context, reference have no input mapping");
    expect(gate.blocker).toContain("a path on the trace");
    expect(gate.blocker).toContain("evaluators.project.attach.edit");
    expect(gate.blocker).not.toContain("optional_note");
  });

  it("reports an invalid filter before unmapped inputs", () => {
    const gate = getProjectEvaluatorSubmitGate({
      targetType: "SESSION",
      isFilterValid: false,
      variables: ["context"],
      submitLabel: "save",
      inputMapping: unmapped,
    });
    expect(gate.submitHint).toBe("Fix the session filter to save");
    expect(gate.blocker).toContain("session filter in the form is invalid");
    expect(gate.blocker).toContain("evaluators.project.scope.edit");
  });

  it("holds the save while the form is still loading", () => {
    const gate = getProjectEvaluatorSubmitGate({
      targetType: "SPAN",
      isFilterValid: true,
      variables: [],
      submitLabel: "update",
      pendingReason: "the form is still loading its Decision version.",
      inputMapping: unmapped,
    });
    expect(gate).toEqual({
      isSubmitDisabled: true,
      blocker: "Not saved: the form is still loading its Decision version.",
    });
  });
});

/**
 * The filter field reports invalid until the server has validated it, which
 * includes the moment after PXI sets a filter; a submit right then waits.
 */
describe("useProjectEvaluatorFilterValidity", () => {
  const probe: { current: ProjectEvaluatorFilterValidity | null } = {
    current: null,
  };
  function Probe() {
    const filterValidity = useProjectEvaluatorFilterValidity();
    useEffect(() => {
      probe.current = filterValidity;
    });
    return null;
  }
  const latest = () => {
    if (!probe.current) throw new Error("Probe has not rendered");
    return probe.current;
  };
  const container = document.createElement("div");
  const root = createRoot(container);
  beforeEach(async () => {
    vi.useFakeTimers();
    await act(async () => root.render(createElement(Probe)));
  });
  afterEach(async () => {
    vi.useRealTimers();
    await act(async () => root.render(null));
  });

  it("waits for a filter being validated to come back valid", async () => {
    act(() => latest().onFilterValidityChange(false));
    const settled = latest().waitForValidFilter();
    act(() => latest().onFilterValidityChange(true));
    await expect(settled).resolves.toBe(true);
  });

  it("gives up on a filter that stays invalid", async () => {
    act(() => latest().onFilterValidityChange(false));
    const settled = latest().waitForValidFilter();
    await act(async () =>
      vi.advanceTimersByTimeAsync(FILTER_VALIDITY_SETTLE_TIMEOUT_MS)
    );
    await expect(settled).resolves.toBe(false);
  });
});
