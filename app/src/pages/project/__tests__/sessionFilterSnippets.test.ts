import { describe, expect, it } from "vitest";

import { MAX_BROWSE_SUGGESTIONS } from "@phoenix/components/filter";

import { sessionFilterCoreVocabulary } from "../sessionFilterCoreVocabulary.generated";
import {
  sessionFilterAIQueryDSL,
  sessionFilterLoopVariables,
  sessionFilterSnippets,
} from "../sessionFilterDSL";

describe("session filter loop variables", () => {
  it("qualifies every generated collection field with its named loop variable", () => {
    const fieldNames = new Set(
      sessionFilterAIQueryDSL.fields.map(({ name }) => name)
    );

    expect(
      sessionFilterCoreVocabulary
        .filter((term): term is typeof term & { iterableName: string } =>
          Boolean(term.iterableName)
        )
        .map(
          ({ iterableName, name }) =>
            `${sessionFilterLoopVariables[iterableName]}.${name}`
        )
        .filter((qualified) => !fieldNames.has(qualified))
    ).toEqual([]);
  });
});

describe("session filter snippets", () => {
  it("offers text search over both input and output in the empty-state dropdown", () => {
    // The retired sessions search field matched either side, so its replacement
    // has to be reachable without typing — and has to search both.
    const browsable = sessionFilterSnippets.slice(0, MAX_BROWSE_SUGGESTIONS);
    const search = browsable.find(({ snippet }) =>
      snippet.includes("any_input")
    );

    expect(search).toBeDefined();
    expect(search?.snippet).toContain("any_output");
    expect(search?.boost).toBeGreaterThan(0);
  });
});
