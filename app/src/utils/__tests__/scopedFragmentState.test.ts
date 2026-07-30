import { describe, expect, it } from "vitest";

import { retainScopedFragmentState } from "../scopedFragmentState";

const PROJECT_A = "/projects/UHJvamVjdDoy";
const PROJECT_B = "/projects/UHJvamVjdDoz";
const EVALUATOR = "/datasets/RGF0YXNldDox/evaluators/RXZhbHVhdG9yOjE";
const FILTER_HASH = "#spanFilterCondition=span_kind+%3D%3D+%27LLM%27";

describe("retainScopedFragmentState", () => {
  it("keeps the span filter while navigation stays inside one project", () => {
    // The crumb from a trace's details back to the project must not clear the
    // filter the user is returning to.
    expect(
      retainScopedFragmentState({
        hash: FILTER_HASH,
        fromPathname: `${PROJECT_A}/traces/abc123`,
        toPathname: PROJECT_A,
      })
    ).toBe(FILTER_HASH);
  });

  it("strips the span filter when a crumb leaves the project", () => {
    // Carried further, the filter lingers on the projects list and can seed a
    // later spans view the user never filtered.
    expect(
      retainScopedFragmentState({
        hash: FILTER_HASH,
        fromPathname: `${PROJECT_A}/spans`,
        toPathname: "/projects",
      })
    ).toBe("");
  });

  it("strips the span filter across project boundaries", () => {
    expect(
      retainScopedFragmentState({
        hash: FILTER_HASH,
        fromPathname: `${PROJECT_A}/spans`,
        toPathname: `${PROJECT_B}/spans`,
      })
    ).toBe("");
  });

  it("scopes the traces-tab key to its project like the spans-tab key", () => {
    const traceHash = "#traceFilterCondition=latency_ms+%3E+10";
    expect(
      retainScopedFragmentState({
        hash: traceHash,
        fromPathname: `${PROJECT_A}/traces/abc123`,
        toPathname: PROJECT_A,
      })
    ).toBe(traceHash);
    expect(
      retainScopedFragmentState({
        hash: traceHash,
        fromPathname: `${PROJECT_A}/traces`,
        toPathname: "/projects",
      })
    ).toBe("");
  });

  it("treats a dataset evaluator's spans view as its own scope", () => {
    const evaluatorHash = "#evaluatorSpanFilterCondition=latency_ms+%3E+10";
    expect(
      retainScopedFragmentState({
        hash: evaluatorHash,
        fromPathname: `${EVALUATOR}/traces/abc123`,
        toPathname: EVALUATOR,
      })
    ).toBe(evaluatorHash);
    // The dataset page itself does not consume the filter.
    expect(
      retainScopedFragmentState({
        hash: evaluatorHash,
        fromPathname: EVALUATOR,
        toPathname: "/datasets/RGF0YXNldDox",
      })
    ).toBe("");
  });

  it("cleans a project key stranded on an evaluator URL, and the reverse", () => {
    // Per-view keys mean a project's filter is foreign state everywhere
    // outside a project. Crumb navigation on an evaluator page removes it
    // rather than carrying it along.
    expect(
      retainScopedFragmentState({
        hash: FILTER_HASH,
        fromPathname: EVALUATOR,
        toPathname: EVALUATOR,
      })
    ).toBe("");
    expect(
      retainScopedFragmentState({
        hash: "#evaluatorSpanFilterCondition=latency_ms+%3E+10",
        fromPathname: `${PROJECT_A}/spans`,
        toPathname: PROJECT_A,
      })
    ).toBe("");
  });

  it("strips a present-but-empty condition at the boundary too", () => {
    // A deliberately-cleared filter is still this scope's state, not the next
    // view's.
    expect(
      retainScopedFragmentState({
        hash: "#spanFilterCondition=",
        fromPathname: `${PROJECT_A}/traces`,
        toPathname: "/projects",
      })
    ).toBe("");
  });

  it("cleans a leftover key even when the source is already out of scope", () => {
    // A crumb clicked on an unrelated page removes a stale filter instead of
    // ferrying it on.
    expect(
      retainScopedFragmentState({
        hash: FILTER_HASH,
        fromPathname: "/projects",
        toPathname: "/datasets",
      })
    ).toBe("");
  });

  it("leaves unregistered fragment entries alone in both directions", () => {
    const mixed = "#other=1&spanFilterCondition=latency_ms+%3E+10";
    expect(
      retainScopedFragmentState({
        hash: mixed,
        fromPathname: `${PROJECT_A}/spans`,
        toPathname: PROJECT_A,
      })
    ).toBe(mixed);
    expect(
      retainScopedFragmentState({
        hash: mixed,
        fromPathname: `${PROJECT_A}/spans`,
        toPathname: "/projects",
      })
    ).toBe("#other=1");
  });

  it("passes empty hashes through unchanged", () => {
    expect(
      retainScopedFragmentState({
        hash: "",
        fromPathname: `${PROJECT_A}/spans`,
        toPathname: "/projects",
      })
    ).toBe("");
    expect(
      retainScopedFragmentState({
        hash: "#",
        fromPathname: `${PROJECT_A}/spans`,
        toPathname: "/projects",
      })
    ).toBe("");
  });
});
