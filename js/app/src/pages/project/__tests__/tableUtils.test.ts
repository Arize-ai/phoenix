import { describe, expect, it } from "vitest";

import {
  getGqlSessionSort,
  getGqlSort,
  makeAnnotationColumnId,
  normalizeAnnotationColumnOrder,
} from "../tableUtils";

describe("tableUtils", () => {
  describe("getGqlSort", () => {
    it("extracts the score attribute from a flat annotation column id", () => {
      expect(
        getGqlSort({
          id: makeAnnotationColumnId("quality", "score"),
          desc: true,
        })
      ).toEqual({
        col: null,
        evalResultKey: { attr: "score", name: "quality" },
        dir: "desc",
      });
    });

    it("does not sort trace annotation columns", () => {
      expect(
        getGqlSort({
          id: makeAnnotationColumnId("quality", "score", "trace"),
          desc: false,
        })
      ).toEqual({ col: null, evalResultKey: null, dir: "asc" });
    });
  });

  describe("getGqlSessionSort", () => {
    it("extracts the score attribute from a flat annotation column id", () => {
      expect(
        getGqlSessionSort({
          id: makeAnnotationColumnId("quality", "score"),
          desc: false,
        })
      ).toEqual({
        col: null,
        annoResultKey: { attr: "score", name: "quality" },
        dir: "asc",
      });
    });

    it("does not sort trace annotation columns", () => {
      expect(
        getGqlSessionSort({
          id: makeAnnotationColumnId("quality", "score", "trace"),
          desc: true,
        })
      ).toEqual({ col: null, annoResultKey: null, dir: "desc" });
    });
  });

  describe("normalizeAnnotationColumnOrder", () => {
    it("maps grouped annotation names to flat ids without changing other ids", () => {
      const qualityColumnId = makeAnnotationColumnId("quality", "score");

      expect(
        normalizeAnnotationColumnOrder({
          columnOrder: ["name", "quality", qualityColumnId, "startTime"],
          annotationColumnIdsByName: new Map([["quality", qualityColumnId]]),
        })
      ).toEqual(["name", qualityColumnId, "startTime"]);
    });
  });
});
