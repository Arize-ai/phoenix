import {
  type AnnotationConfigDraftHost,
  type AnnotationConfigDraftSnapshot,
  applyDraftOperations,
  createEditAnnotationConfigDraftClientAction,
  createReadAnnotationConfigDraftClientAction,
  type EditAnnotationConfigDraftOperation,
  parseEditAnnotationConfigDraftInput,
  parseOpenAnnotationConfigFormInput,
} from "@phoenix/agent/tools/annotationConfigDraft";

function makeSnapshot(
  overrides: Partial<AnnotationConfigDraftSnapshot> = {}
): AnnotationConfigDraftSnapshot {
  return {
    mode: "create",
    annotationConfigNodeId: null,
    annotationType: "CATEGORICAL",
    name: "",
    description: null,
    optimizationDirection: "MAXIMIZE",
    values: [
      { label: "", score: null },
      { label: "", score: null },
    ],
    lowerBound: null,
    upperBound: null,
    ...overrides,
  };
}

/** Mutable in-memory host so client-action tests can observe applied edits. */
function makeHost(initial: AnnotationConfigDraftSnapshot): {
  host: AnnotationConfigDraftHost;
  get: () => AnnotationConfigDraftSnapshot;
} {
  let current = initial;
  const host: AnnotationConfigDraftHost = {
    getSnapshot: () => current,
    previewOperations: (snapshot, operations) =>
      applyDraftOperations({ snapshot, operations }),
    applyOperations: (operations) => {
      const result = applyDraftOperations({ snapshot: current, operations });
      if (result.ok) current = result.output;
      return result;
    },
  };
  return { host, get: () => current };
}

describe("applyDraftOperations", () => {
  it("sets scalar fields", () => {
    const result = applyDraftOperations({
      snapshot: makeSnapshot(),
      operations: [
        { type: "set_name", name: "correctness" },
        { type: "set_description", description: "is it correct" },
        { type: "set_optimization_direction", optimizationDirection: "MINIMIZE" },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.name).toBe("correctness");
    expect(result.output.description).toBe("is it correct");
    expect(result.output.optimizationDirection).toBe("MINIMIZE");
  });

  it("replaces categorical values", () => {
    const result = applyDraftOperations({
      snapshot: makeSnapshot(),
      operations: [
        {
          type: "set_values",
          values: [
            { label: "correct", score: 1 },
            { label: "incorrect", score: 0 },
          ],
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.values).toEqual([
      { label: "correct", score: 1 },
      { label: "incorrect", score: 0 },
    ]);
  });

  it("rejects changing annotation type in edit mode", () => {
    const result = applyDraftOperations({
      snapshot: makeSnapshot({ mode: "edit", annotationConfigNodeId: "Q29uZmlnOjE" }),
      operations: [{ type: "set_annotation_type", annotationType: "CONTINUOUS" }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/immutable/i);
  });
});

describe("parseEditAnnotationConfigDraftInput", () => {
  it("normalizes a single bare snake_case operation into the operations array", () => {
    const parsed = parseEditAnnotationConfigDraftInput({
      type: "set_optimization_direction",
      optimization_direction: "MINIMIZE",
    });
    expect(parsed).not.toBeNull();
    const operations = parsed?.operations as
      | EditAnnotationConfigDraftOperation[]
      | undefined;
    expect(operations?.[0]).toEqual({
      type: "set_optimization_direction",
      optimizationDirection: "MINIMIZE",
    });
  });

  it("rejects an empty operations list", () => {
    expect(parseEditAnnotationConfigDraftInput({ operations: [] })).toBeNull();
  });
});

describe("parseOpenAnnotationConfigFormInput", () => {
  it("defaults to create mode when no id is given", () => {
    expect(parseOpenAnnotationConfigFormInput(undefined)).toEqual({
      annotationConfigId: null,
    });
    expect(parseOpenAnnotationConfigFormInput({})).toEqual({
      annotationConfigId: null,
    });
  });

  it("keeps a provided config id", () => {
    expect(
      parseOpenAnnotationConfigFormInput({ annotationConfigId: "Q29uZmlnOjE" })
    ).toEqual({ annotationConfigId: "Q29uZmlnOjE" });
  });

  it("normalizes a snake_case id", () => {
    expect(
      parseOpenAnnotationConfigFormInput({ annotation_config_id: "Q29uZmlnOjE" })
    ).toEqual({ annotationConfigId: "Q29uZmlnOjE" });
  });
});

describe("annotation-config draft client actions", () => {
  it("reads the current snapshot as formatted JSON", async () => {
    const { host } = makeHost(makeSnapshot({ name: "correctness" }));
    const read = createReadAnnotationConfigDraftClientAction({
      getDraftHost: () => host,
    });
    const result = await read({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.parse(result.output ?? "").name).toBe("correctness");
  });

  it("applies edits directly to the draft", async () => {
    const { host, get } = makeHost(makeSnapshot());
    const edit = createEditAnnotationConfigDraftClientAction({
      getDraftHost: () => host,
    });
    const result = await edit({
      operations: [{ type: "set_name", name: "relevance" }],
    });
    expect(result.ok).toBe(true);
    expect(get().name).toBe("relevance");
  });

  it("errors when the form is not mounted", async () => {
    const edit = createEditAnnotationConfigDraftClientAction({
      getDraftHost: () => null,
    });
    const result = await edit({
      operations: [{ type: "set_name", name: "relevance" }],
    });
    expect(result.ok).toBe(false);
  });
});
