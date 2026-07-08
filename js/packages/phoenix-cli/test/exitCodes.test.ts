import { describe, expect, it } from "vitest";

import { ExitCode, getExitCodeForError } from "../src/exitCodes";

describe("ExitCode constants", () => {
  it("SUCCESS is 0", () => {
    expect(ExitCode.SUCCESS).toBe(0);
  });

  it("FAILURE is 1", () => {
    expect(ExitCode.FAILURE).toBe(1);
  });

  it("CANCELLED is 2", () => {
    expect(ExitCode.CANCELLED).toBe(2);
  });

  it("INVALID_ARGUMENT is 3", () => {
    expect(ExitCode.INVALID_ARGUMENT).toBe(3);
  });

  it("AUTH_REQUIRED is 4", () => {
    expect(ExitCode.AUTH_REQUIRED).toBe(4);
  });

  it("NETWORK_ERROR is 5", () => {
    expect(ExitCode.NETWORK_ERROR).toBe(5);
  });
});

describe("getExitCodeForError", () => {
  it("returns NETWORK_ERROR for a TypeError (fetch network failure)", () => {
    const error = new TypeError("fetch failed");
    expect(getExitCodeForError(error)).toBe(ExitCode.NETWORK_ERROR);
  });

  it("returns NETWORK_ERROR for any TypeError regardless of message", () => {
    const error = new TypeError("Failed to fetch");
    expect(getExitCodeForError(error)).toBe(ExitCode.NETWORK_ERROR);
  });

  it("returns FAILURE for a generic Error", () => {
    const error = new Error("Something went wrong");
    expect(getExitCodeForError(error)).toBe(ExitCode.FAILURE);
  });

  it("returns FAILURE for a string error", () => {
    expect(getExitCodeForError("some error string")).toBe(ExitCode.FAILURE);
  });

  it("returns FAILURE for null", () => {
    expect(getExitCodeForError(null)).toBe(ExitCode.FAILURE);
  });

  it("returns FAILURE for undefined", () => {
    expect(getExitCodeForError(undefined)).toBe(ExitCode.FAILURE);
  });

  it("returns FAILURE for a RangeError (not a network failure)", () => {
    const error = new RangeError("out of range");
    expect(getExitCodeForError(error)).toBe(ExitCode.FAILURE);
  });
});
