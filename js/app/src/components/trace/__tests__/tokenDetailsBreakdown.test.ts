import { CATEGORICAL_CHART_COLORS } from "@phoenix/components/chart/colors";
import { buildTokenBreakdown } from "@phoenix/components/trace/TokenDetailsBreakdown";

/** Each category resolves to its own name, so colors can be read in assertions. */
const colors = Object.fromEntries(
  CATEGORICAL_CHART_COLORS.map((color) => [color, color])
) as Record<(typeof CATEGORICAL_CHART_COLORS)[number], string>;

describe("buildTokenBreakdown", () => {
  it("lays tokens and costs over one set of token-type segments in canonical order", () => {
    const { segments, dimensions } = buildTokenBreakdown({
      colors,
      tokens: {
        total: 49_494,
        prompt: 48_210,
        completion: 1_284,
        promptDetails: { cache_write: 3_120, input: 3_490, cache_read: 41_600 },
      },
      costs: {
        total: 0.0539,
        prompt: 0.0347,
        completion: 0.0193,
        promptDetails: {
          cache_write: 0.0117,
          input: 0.0105,
          cache_read: 0.0125,
        },
      },
    });

    expect(segments.map((segment) => segment.label)).toEqual([
      "Input",
      "Cache read",
      "Cache write",
      "Output",
    ]);
    expect(dimensions.map((dimension) => dimension.key)).toEqual([
      "tokens",
      "cost",
    ]);
    const [tokens, cost] = dimensions;
    expect(tokens.values["prompt:cache_read"]).toBe(41_600);
    expect(cost.values["prompt:cache_read"]).toBe(0.0125);
    // Output is not in the details, so the completion total is attributed to it
    expect(tokens.values["completion:output"]).toBe(1_284);
    expect(cost.values["completion:output"]).toBeCloseTo(0.0193);
  });

  it("marks where the prompt ends in each dimension that has both sides", () => {
    const { dimensions } = buildTokenBreakdown({
      colors,
      tokens: { total: 100, prompt: 80, completion: 20 },
      costs: { total: 1, prompt: 0.25 },
    });
    expect(dimensions[0].markerValues).toEqual([80]);
    expect(dimensions[1].markerValues).toBeUndefined();
  });

  it("attributes what the details leave unaccounted to plain input or output", () => {
    const { segments, dimensions } = buildTokenBreakdown({
      colors,
      tokens: {
        total: 84_320,
        prompt: 78_100,
        completion: 6_220,
        promptDetails: { cache_read: 61_326 },
      },
    });
    expect(segments.map((segment) => segment.key)).toEqual([
      "prompt:input",
      "prompt:cache_read",
      "completion:output",
    ]);
    expect(dimensions[0].values["prompt:input"]).toBe(16_774);
  });

  it("tells a token type used on both sides apart by its side", () => {
    const { segments } = buildTokenBreakdown({
      colors,
      tokens: {
        total: 9_400,
        prompt: 7_000,
        completion: 2_400,
        promptDetails: { input: 3_000, audio: 4_000 },
        completionDetails: { output: 1_400, audio: 1_000 },
      },
    });
    expect(segments.map((segment) => segment.label)).toEqual([
      "Input",
      "Prompt audio",
      "Output",
      "Completion audio",
    ]);
    // The two are separate segments, so each has its own color, as in the
    // metrics charts; the first keeps the type's color
    const [, promptAudio, , completionAudio] = segments;
    expect(promptAudio.color).toBe(colors.category3);
    expect(new Set(segments.map((segment) => segment.color)).size).toBe(
      segments.length
    );
    expect(completionAudio.color).not.toBe(promptAudio.color);
  });

  it("keeps a type one measure reports as zero as a measured zero", () => {
    const { dimensions } = buildTokenBreakdown({
      colors,
      tokens: {
        total: 4_200,
        prompt: 4_000,
        completion: 200,
        promptDetails: { input: 2_800, cache_read: 1_200 },
      },
      costs: {
        total: 0.03,
        prompt: 0.028,
        completion: 0.002,
        // Counted, but priced at nothing
        promptDetails: { input: 0.028, cache_read: 0 },
      },
    });
    const [tokens, cost] = dimensions;
    expect(tokens.values["prompt:cache_read"]).toBe(1_200);
    expect(cost.values["prompt:cache_read"]).toBe(0);
  });

  it("keeps a measure with only a total as an unsegmented dimension", () => {
    const { segments, dimensions } = buildTokenBreakdown({
      colors,
      tokens: { total: 49_494 },
      costs: { total: 0.0539 },
    });
    expect(segments).toEqual([]);
    expect(dimensions.map((dimension) => dimension.total)).toEqual([
      49_494, 0.0539,
    ]);
  });

  it("leaves out a measure with no usage", () => {
    const { dimensions } = buildTokenBreakdown({
      colors,
      tokens: { total: 100, prompt: 80, completion: 20 },
      costs: { total: 0, prompt: 0, completion: 0 },
    });
    expect(dimensions.map((dimension) => dimension.key)).toEqual(["tokens"]);
  });
});
