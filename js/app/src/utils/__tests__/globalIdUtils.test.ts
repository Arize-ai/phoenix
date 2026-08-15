import { describe, expect, it } from "vitest";

import {
  fromGlobalIdWithExpectedType,
  isGlobalIdOfType,
  parseGlobalId,
  toGlobalId,
} from "../globalIdUtils";

describe("globalIdUtils", () => {
  describe("parseGlobalId", () => {
    it("decodes a canonical base64 global ID into type and node id", () => {
      expect(parseGlobalId(toGlobalId("Span", 123))).toEqual({
        typeName: "Span",
        nodeId: "123",
      });
    });

    it("keeps non-numeric and colon-containing node ids intact", () => {
      expect(parseGlobalId(toGlobalId("SandboxProvider", "modal:us"))).toEqual({
        typeName: "SandboxProvider",
        nodeId: "modal:us",
      });
    });

    it("trims surrounding whitespace before decoding", () => {
      expect(parseGlobalId(`  ${toGlobalId("Span", 1)}  `)).toEqual({
        typeName: "Span",
        nodeId: "1",
      });
    });

    it("rejects non-canonical base64 (stray padding)", () => {
      expect(parseGlobalId(`${toGlobalId("Span", 1153)}=`)).toBeNull();
    });

    it("rejects values that are not base64 or lack a type separator", () => {
      expect(parseGlobalId("not base64!")).toBeNull();
      expect(parseGlobalId(globalThis.btoa("Span"))).toBeNull();
      expect(parseGlobalId(globalThis.btoa(":123"))).toBeNull();
      expect(parseGlobalId(globalThis.btoa("Span:"))).toBeNull();
    });
  });

  describe("isGlobalIdOfType", () => {
    it("matches only the encoded type name", () => {
      const spanId = toGlobalId("Span", 1);
      expect(isGlobalIdOfType(spanId, "Span")).toBe(true);
      expect(isGlobalIdOfType(spanId, "Project")).toBe(false);
      expect(isGlobalIdOfType("garbage", "Span")).toBe(false);
    });
  });

  describe("fromGlobalIdWithExpectedType", () => {
    it("returns the parsed ID when the type matches", () => {
      expect(
        fromGlobalIdWithExpectedType(toGlobalId("Span", 7), "Span")
      ).toEqual({ typeName: "Span", nodeId: "7" });
    });

    it("throws a descriptive error on a type mismatch", () => {
      expect(() =>
        fromGlobalIdWithExpectedType(toGlobalId("Project", 7), "Span")
      ).toThrow("corresponds to a node of type: Project");
    });

    it("throws on a malformed ID", () => {
      expect(() => fromGlobalIdWithExpectedType("garbage", "Span")).toThrow(
        "Invalid global node ID"
      );
    });
  });
});
