import {
  applyProjectEvaluatorScopePatch,
  createEditProjectEvaluatorScopeClientAction,
  createReadProjectEvaluatorScopeClientAction,
  editProjectEvaluatorScopeInputSchema,
  type ProjectEvaluatorScopeHost,
} from "@phoenix/agent/tools/projectEvaluatorScope";
import {
  grantScriptApproval,
  revokeScriptApproval,
} from "@phoenix/agent/uiOperations/scriptApprovalGrant";
import type { ProjectEvaluatorScope } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

const SPAN_SCOPE: ProjectEvaluatorScope = {
  targetType: "SPAN",
  filterCondition: "parent_id is None",
  samplingRate: 1,
  evaluationDelaySeconds: 300,
  tracingEnabled: true,
};

describe("applyProjectEvaluatorScopePatch", () => {
  it("changes only the fields the patch names", () => {
    const result = applyProjectEvaluatorScopePatch({
      scope: SPAN_SCOPE,
      patch: { filterCondition: " span_kind == 'LLM' ", samplingRate: 0.25 },
      isTargetEditable: true,
    });
    expect(result).toEqual({
      ok: true,
      scope: {
        ...SPAN_SCOPE,
        filterCondition: "span_kind == 'LLM'",
        samplingRate: 0.25,
      },
    });
  });

  it("keeps sampling to whole percents, as the slider does", () => {
    const result = applyProjectEvaluatorScopePatch({
      scope: SPAN_SCOPE,
      patch: { samplingRate: 0.333 },
      isTargetEditable: true,
    });
    expect(result.ok && result.scope.samplingRate).toBe(0.33);
  });

  it("resets the filter to the new target's default on a target change", () => {
    const result = applyProjectEvaluatorScopePatch({
      scope: SPAN_SCOPE,
      patch: { targetType: "SESSION" },
      isTargetEditable: true,
    });
    expect(result.ok && result.scope).toMatchObject({
      targetType: "SESSION",
      filterCondition: "",
    });
  });

  it("restores the filter last written on the target it returns to", () => {
    const result = applyProjectEvaluatorScopePatch({
      scope: SPAN_SCOPE,
      patch: { targetType: "SESSION" },
      isTargetEditable: true,
      rememberedFilters: { SESSION: "num_traces >= 2" },
    });
    expect(result.ok && result.scope.filterCondition).toBe("num_traces >= 2");
  });

  it("prefers a filter given with the target change", () => {
    const result = applyProjectEvaluatorScopePatch({
      scope: SPAN_SCOPE,
      patch: {
        targetType: "SESSION",
        filterCondition: "num_traces >= 5",
        evaluationDelaySeconds: 120,
      },
      isTargetEditable: true,
      rememberedFilters: { SESSION: "num_traces >= 2" },
    });
    expect(result.ok && result.scope).toMatchObject({
      targetType: "SESSION",
      filterCondition: "num_traces >= 5",
      evaluationDelaySeconds: 120,
    });
  });

  it("refuses a target change on an edit form", () => {
    const result = applyProjectEvaluatorScopePatch({
      scope: SPAN_SCOPE,
      patch: { targetType: "TRACE" },
      isTargetEditable: false,
    });
    expect(result.ok).toBe(false);
  });

  it("refuses a delay for span targets", () => {
    const result = applyProjectEvaluatorScopePatch({
      scope: SPAN_SCOPE,
      patch: { evaluationDelaySeconds: 60 },
      isTargetEditable: true,
    });
    expect(result.ok).toBe(false);
  });
});

describe("editProjectEvaluatorScopeInputSchema", () => {
  it("rejects a percent passed as a sampling fraction", () => {
    expect(
      editProjectEvaluatorScopeInputSchema.safeParse({ samplingRate: 25 })
        .success
    ).toBe(false);
  });

  it("rejects an empty patch", () => {
    expect(editProjectEvaluatorScopeInputSchema.safeParse({}).success).toBe(
      false
    );
  });

  it("rejects a delay under the server's minimum", () => {
    expect(
      editProjectEvaluatorScopeInputSchema.safeParse({
        evaluationDelaySeconds: 5,
      }).success
    ).toBe(false);
  });
});

function makeHost(overrides: Partial<ProjectEvaluatorScopeHost> = {}) {
  let scope = SPAN_SCOPE;
  const applied: ProjectEvaluatorScope[] = [];
  const host: ProjectEvaluatorScopeHost = {
    getScope: () => scope,
    isTargetEditable: () => true,
    getRememberedFilters: () => ({}),
    validateFilter: async () => ({ isValid: true }),
    applyScope: (next) => {
      scope = next;
      applied.push(next);
    },
    ...overrides,
  };
  return { host, applied };
}

const CALL_ID = "scope-tool-call";
const CONTEXT = { callId: `${CALL_ID}:1`, sessionId: "session" };

describe("project evaluator scope client actions", () => {
  beforeEach(() => grantScriptApproval(CALL_ID));
  afterEach(() => revokeScriptApproval(CALL_ID));

  it("reads the scope with its filter language", async () => {
    const { host } = makeHost();
    const read = createReadProjectEvaluatorScopeClientAction({
      getHost: () => host,
    });
    expect(await read()).toEqual({
      ok: true,
      output: {
        targetType: "SPAN",
        filterLanguage: "span",
        filterCondition: "parent_id is None",
        samplingRate: 1,
        evaluationDelaySeconds: null,
        tracingEnabled: true,
        isTargetEditable: true,
      },
    });
  });

  it("applies a valid edit and returns the new scope", async () => {
    const { host, applied } = makeHost();
    const edit = createEditProjectEvaluatorScopeClientAction({
      getHost: () => host,
    });
    const result = await edit(
      { filterCondition: "span_kind == 'LLM'", samplingRate: 0.25 },
      CONTEXT
    );
    expect(result.ok).toBe(true);
    expect(applied).toEqual([
      {
        ...SPAN_SCOPE,
        filterCondition: "span_kind == 'LLM'",
        samplingRate: 0.25,
      },
    ]);
  });

  it("leaves the form alone when the filter does not validate", async () => {
    const validateFilter = vi.fn(async () => ({
      isValid: false,
      errorMessage: "unknown name 'spankind'",
    }));
    const { host, applied } = makeHost({ validateFilter });
    const edit = createEditProjectEvaluatorScopeClientAction({
      getHost: () => host,
    });
    const result = await edit(
      { filterCondition: "spankind == 'LLM'" },
      CONTEXT
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain("unknown name 'spankind'");
    expect(validateFilter).toHaveBeenCalledWith({
      targetType: "SPAN",
      filterCondition: "spankind == 'LLM'",
    });
    expect(applied).toEqual([]);
  });

  it("skips validation when neither the filter nor the target changes", async () => {
    const validateFilter = vi.fn(async () => ({ isValid: true }));
    const { host } = makeHost({ validateFilter });
    const edit = createEditProjectEvaluatorScopeClientAction({
      getHost: () => host,
    });
    await edit({ samplingRate: 0.5 }, CONTEXT);
    expect(validateFilter).not.toHaveBeenCalled();
  });

  it("does not write to a form closed while the filter validated", async () => {
    let current: ProjectEvaluatorScopeHost | null = null;
    const { host, applied } = makeHost({
      validateFilter: async () => {
        current = null;
        return { isValid: true };
      },
    });
    current = host;
    const edit = createEditProjectEvaluatorScopeClientAction({
      getHost: () => current,
    });
    const result = await edit(
      { filterCondition: "span_kind == 'LLM'" },
      CONTEXT
    );
    expect(result.ok).toBe(false);
    expect(applied).toEqual([]);
  });

  it("needs an approved script or bypass mode", async () => {
    const { host, applied } = makeHost();
    const edit = createEditProjectEvaluatorScopeClientAction({
      getHost: () => host,
    });
    const result = await edit(
      { samplingRate: 0.5 },
      { callId: "unapproved:1", sessionId: "session" }
    );
    expect(result.ok).toBe(false);
    expect(applied).toEqual([]);
  });
});
