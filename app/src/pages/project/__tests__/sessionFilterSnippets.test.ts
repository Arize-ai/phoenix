import { describe, expect, it } from "vitest";

import { MAX_BROWSE_SUGGESTIONS } from "@phoenix/components/filter";

import { sessionFilterCoreVocabulary } from "../sessionFilterCoreVocabulary.generated";
import {
  sessionFilterLoopVariables,
  sessionFilterSnippets,
} from "../sessionFilterDSL";

describe("session filter loop variables", () => {
  it("names a loop variable for every collection in the generated vocabulary", () => {
    // A newly generated collection must be named here rather than take the
    // singularizing fallback, which can produce a variable the compiler and
    // the vocabulary's own descriptions disagree about.
    const iterableNames = new Set(
      sessionFilterCoreVocabulary
        .map(({ iterableName }) => iterableName)
        .filter((name): name is string => Boolean(name))
    );

    expect(
      [...iterableNames].filter((name) => !sessionFilterLoopVariables[name])
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
