import { describe, expect, it } from "vitest";

import {
  getNonNoteAnnotationNames,
  getVisibleSpanAnnotationColumnNames,
} from "../spanAnnotationUtils";

describe("spanAnnotationUtils", () => {
  describe("getNonNoteAnnotationNames", () => {
    it('removes the reserved "note" annotation name', () => {
      expect(
        getNonNoteAnnotationNames(["note", "toxicity", "sentiment"])
      ).toEqual(["toxicity", "sentiment"]);
    });

    it("preserves non-note annotation names in order", () => {
      expect(getNonNoteAnnotationNames(["toxicity", "sentiment"])).toEqual([
        "toxicity",
        "sentiment",
      ]);
    });
  });

  describe("getVisibleSpanAnnotationColumnNames", () => {
    it("returns only visible filtered annotation names in server order", () => {
      expect(
        getVisibleSpanAnnotationColumnNames({
          spanAnnotationNames: ["note", "toxicity", "sentiment"],
          annotationVisibility: {
            sentiment: true,
            toxicity: true,
          },
        })
      ).toEqual(["toxicity", "sentiment"]);
    });

    it("ignores hidden annotation names", () => {
      expect(
        getVisibleSpanAnnotationColumnNames({
          spanAnnotationNames: ["toxicity", "sentiment"],
          annotationVisibility: {
            toxicity: false,
            sentiment: true,
          },
        })
      ).toEqual(["sentiment"]);
    });
  });
});
