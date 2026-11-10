import {
  fromOutputConfigDraft,
  toOutputConfigDrafts,
} from "../outputConfigConverters";
import { outputConfigDraftSchema } from "../schemas";

describe("continuous output thresholds in PXI drafts", () => {
  it("reads a continuous config's threshold without turning it freeform", () => {
    expect(
      toOutputConfigDrafts([
        {
          annotationType: "CONTINUOUS",
          name: "helpfulness",
          optimizationDirection: "MAXIMIZE",
          lowerBound: 0,
          upperBound: 10,
          threshold: 7,
        },
      ])
    ).toEqual([
      {
        kind: "continuous",
        name: "helpfulness",
        optimizationDirection: "MAXIMIZE",
        lowerBound: 0,
        upperBound: 10,
        threshold: 7,
      },
    ]);
  });

  it("writes a continuous draft's threshold back as a tagged continuous config", () => {
    const draft = outputConfigDraftSchema.parse({
      kind: "continuous",
      name: "helpfulness",
      optimizationDirection: "MAXIMIZE",
      lower_bound: 0,
      upper_bound: 10,
      threshold: 7,
    });
    const config = fromOutputConfigDraft(draft);
    expect(config).toEqual({
      annotationType: "CONTINUOUS",
      name: "helpfulness",
      optimizationDirection: "MAXIMIZE",
      lowerBound: 0,
      upperBound: 10,
      threshold: 7,
    });
    expect(toOutputConfigDrafts([config])[0].kind).toBe("continuous");
  });

  it("keeps freeform drafts freeform", () => {
    const config = fromOutputConfigDraft({
      kind: "freeform",
      name: "notes",
      optimizationDirection: "NONE",
      threshold: 0.5,
    });
    expect(config).toMatchObject({
      annotationType: "FREEFORM",
      threshold: 0.5,
    });
    expect(toOutputConfigDrafts([config])[0].kind).toBe("freeform");
  });
});
