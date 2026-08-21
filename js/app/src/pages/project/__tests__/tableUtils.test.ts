import { describe, expect, it } from "vitest";

import {
  getGqlSessionSort,
  getGqlSort,
  makeFlatAnnotationColumnId,
  normalizeAnnotationColumnOrder,
} from "../tableUtils";

describe("tableUtils", () => {
  describe("getGqlSort", () => {
    it("extracts the score attribute from a flat annotation column id", () => {
      expect(
        getGqlSort({
          id: makeFlatAnnotationColumnId("quality"),
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
          id: makeFlatAnnotationColumnId("quality", "trace"),
          desc: false,
        })
      ).toEqual({ col: null, evalResultKey: null, dir: "asc" });
    });
  });

  describe("getGqlSessionSort", () => {
    it("extracts the score attribute from a flat annotation column id", () => {
      expect(
        getGqlSessionSort({
          id: makeFlatAnnotationColumnId("quality"),
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
          id: makeFlatAnnotationColumnId("quality", "trace"),
          desc: true,
        })
      ).toEqual({ col: null, annoResultKey: null, dir: "desc" });
    });
  });

  describe("normalizeAnnotationColumnOrder", () => {
    it("maps grouped annotation names to flat ids without changing other ids", () => {
      const qualityColumnId = makeFlatAnnotationColumnId("quality");

      expect(
        normalizeAnnotationColumnOrder({
          columnOrder: ["name", "quality", qualityColumnId, "startTime"],
          annotationKinds: [
            {
              names: ["quality"],
              getColumnId: (name) => makeFlatAnnotationColumnId(name),
            },
          ],
        })
      ).toEqual(["name", qualityColumnId, "startTime"]);
    });

    it("resolves a name shared across kinds to the first kind listed", () => {
      const spanColumnId = makeFlatAnnotationColumnId("quality");

      expect(
        normalizeAnnotationColumnOrder({
          columnOrder: ["quality"],
          annotationKinds: [
            {
              names: ["quality"],
              getColumnId: (name) => makeFlatAnnotationColumnId(name),
            },
            {
              names: ["quality"],
              getColumnId: (name) => makeFlatAnnotationColumnId(name, "trace"),
            },
          ],
        })
      ).toEqual([spanColumnId]);
    });
  });
});
