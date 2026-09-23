import { describe, expect, it } from "vitest";

import {
  ANNOTATIONS_COLUMN_PREFIX,
  ANNOTATIONS_KEY_SEPARATOR,
  getGqlSessionSort,
  getGqlSort,
  makeFlatAnnotationColumnId,
  normalizeAnnotationColumnOrder,
} from "../tableUtils";

const ANNOTATION_NAMES_WITH_SPECIAL_CHARS = [
  ["spaces", "my annotation"],
  ["dashes", "hallucination-check"],
  ["underscores", "qa_score"],
  ["punctuation", "Q&A"],
  ["percent signs", "top 10%"],
  ["unicode", "质量"],
] as const;

describe("tableUtils", () => {
  describe("makeFlatAnnotationColumnId", () => {
    it("keeps alphanumeric names as a stable persisted column id", () => {
      expect(makeFlatAnnotationColumnId("quality")).toEqual(
        "annotations-score-quality"
      );
    });
  });

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

    it.each(ANNOTATION_NAMES_WITH_SPECIAL_CHARS)(
      "round-trips score sorts for annotation names with %s",
      (_label, name) => {
        expect(
          getGqlSort({
            id: makeFlatAnnotationColumnId(name),
            desc: true,
          })
        ).toEqual({
          col: null,
          evalResultKey: { attr: "score", name },
          dir: "desc",
        });
      }
    );

    it.each(ANNOTATION_NAMES_WITH_SPECIAL_CHARS)(
      "round-trips label sorts for annotation names with %s",
      (_label, name) => {
        expect(
          getGqlSort({
            id: [
              ANNOTATIONS_COLUMN_PREFIX,
              "label",
              encodeURIComponent(name),
            ].join(ANNOTATIONS_KEY_SEPARATOR),
            desc: false,
          })
        ).toEqual({
          col: null,
          evalResultKey: { attr: "label", name },
          dir: "asc",
        });
      }
    );

    it("does not sort trace annotation columns", () => {
      expect(
        getGqlSort({
          id: makeFlatAnnotationColumnId("quality", "trace"),
          desc: false,
        })
      ).toEqual({ col: null, evalResultKey: null, dir: "asc" });
    });

    it("does not sort trace annotation columns whose names contain spaces", () => {
      expect(
        getGqlSort({
          id: makeFlatAnnotationColumnId("my annotation", "trace"),
          desc: true,
        })
      ).toEqual({ col: null, evalResultKey: null, dir: "desc" });
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

    it.each(ANNOTATION_NAMES_WITH_SPECIAL_CHARS)(
      "round-trips score sorts for annotation names with %s",
      (_label, name) => {
        expect(
          getGqlSessionSort({
            id: makeFlatAnnotationColumnId(name),
            desc: false,
          })
        ).toEqual({
          col: null,
          annoResultKey: { attr: "score", name },
          dir: "asc",
        });
      }
    );

    it.each(ANNOTATION_NAMES_WITH_SPECIAL_CHARS)(
      "round-trips label sorts for annotation names with %s",
      (_label, name) => {
        expect(
          getGqlSessionSort({
            id: [
              ANNOTATIONS_COLUMN_PREFIX,
              "label",
              encodeURIComponent(name),
            ].join(ANNOTATIONS_KEY_SEPARATOR),
            desc: true,
          })
        ).toEqual({
          col: null,
          annoResultKey: { attr: "label", name },
          dir: "desc",
        });
      }
    );

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
