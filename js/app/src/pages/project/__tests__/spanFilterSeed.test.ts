import { describe, expect, it } from "vitest";

import {
  ORPHAN_AWARE_ROOT_SPANS_CONDITION,
  STRICT_ROOT_SPANS_CONDITION,
} from "../spanFilterRootScopeConstants";
import { spanFilterSeed } from "../spanFilterSeed";

// Classification only. That the exempt conditions never reach the server is
// asserted in spanFilterValidation.test.ts, where the request is observable.
describe("spanFilterSeed", () => {
  it("classifies an empty condition as needing no server answer", () => {
    expect(spanFilterSeed("")).toEqual({
      condition: "",
      requiresServerValidation: false,
      rootSpansOnly: false,
    });
  });

  it("normalizes a whitespace-only condition to the empty one", () => {
    expect(spanFilterSeed("   ")).toEqual({
      condition: "",
      requiresServerValidation: false,
      rootSpansOnly: false,
    });
  });

  it("classifies the strict root-span predicate as needing no server answer", () => {
    expect(spanFilterSeed(STRICT_ROOT_SPANS_CONDITION)).toEqual({
      condition: STRICT_ROOT_SPANS_CONDITION,
      requiresServerValidation: false,
      rootSpansOnly: true,
    });
  });

  it("classifies the orphan-aware root predicate as needing no server answer", () => {
    expect(spanFilterSeed(ORPHAN_AWARE_ROOT_SPANS_CONDITION)).toEqual({
      condition: ORPHAN_AWARE_ROOT_SPANS_CONDITION,
      requiresServerValidation: false,
      rootSpansOnly: true,
    });
  });

  it("requires server validation for an arbitrary condition", () => {
    expect(spanFilterSeed("status_code == 'ERROR'")).toEqual({
      condition: "status_code == 'ERROR'",
      requiresServerValidation: true,
    });
  });

  it("validates a root-scoped condition it cannot recognize literally", () => {
    // Root-scoped in fact, but only the server's analysis can say so; the
    // classifier deliberately does not re-implement the DSL grammar.
    expect(
      spanFilterSeed("parent_id is None and status_code == 'ERROR'")
    ).toEqual({
      condition: "parent_id is None and status_code == 'ERROR'",
      requiresServerValidation: true,
    });
  });

  it("validates a reformatted root-span predicate on the server", () => {
    // The exemption uses literal equality, so even semantically identical
    // spellings require server validation.
    expect(spanFilterSeed("parent_id  is  None")).toEqual({
      condition: "parent_id  is  None",
      requiresServerValidation: true,
    });
  });
});
