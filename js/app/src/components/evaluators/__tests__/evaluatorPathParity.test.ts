import { resolveEvaluatorPath } from "../evaluatorPathCompletions";
import parity from "./evaluatorPathParity.json";

type ParityCase = {
  context: string;
  path: string;
  outcome: "value" | "unresolved" | "unverifiable";
  value?: unknown;
};

const { contexts, cases } = parity as {
  contexts: Record<string, Record<string, unknown>>;
  cases: ParityCase[];
};

describe("resolveEvaluatorPath parity with the server", () => {
  it.each(cases)("$path", ({ context, path, outcome, value }) => {
    const resolution = resolveEvaluatorPath({
      source: contexts[context],
      path,
    });
    if (outcome === "value") {
      expect(resolution).toMatchObject({ status: "resolved", value });
    } else {
      expect(resolution.status).toBe(outcome);
    }
  });
});
