import { describe, expect, it } from "vitest";

import { MAX_BROWSE_SUGGESTIONS } from "@phoenix/components/filter";

import { sessionFilterSnippets } from "../SessionFilterConditionField";

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
