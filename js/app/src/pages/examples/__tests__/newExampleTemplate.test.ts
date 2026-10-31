import type { DatasetExampleTableRow } from "../datasetExampleTableTypes";
import { getNewExampleTemplate } from "../newExampleTemplate";

const makeRow = (
  overrides: Partial<DatasetExampleTableRow>
): DatasetExampleTableRow => ({
  id: "row",
  externalId: null,
  splits: [],
  input: {},
  output: {},
  metadata: {},
  isNew: false,
  ...overrides,
});

describe("getNewExampleTemplate", () => {
  it("starts from empty objects when the dataset has no saved examples", () => {
    expect(getNewExampleTemplate([])).toEqual({
      input: {},
      output: {},
      metadata: {},
    });
  });

  it("uses the first saved example's shape, skipping unsaved rows", () => {
    const rows = [
      makeRow({ id: "new", isNew: true, input: { draft: "x" } }),
      makeRow({
        id: "saved",
        input: { messages: [{ role: "user", content: "Link me" }] },
        output: { tools: { required: ["get_route_info"] } },
        metadata: { category: "retention" },
      }),
    ];
    expect(getNewExampleTemplate(rows)).toEqual({
      input: { messages: [{ role: "", content: "" }] },
      output: { tools: { required: [""] } },
      metadata: { category: "" },
    });
  });
});
