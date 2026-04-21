import { describe, expect, it } from "vitest";

import {
  getFilteredSpanAnnotationNames,
  getVisibleSpanAnnotationColumnNames,
} from "../spanAnnotationUtils";

describe("spanAnnotationUtils", () => {
  describe("getFilteredSpanAnnotationNames", () => {
    it('removes the reserved "note" annotation name', () => {
      expect(
        getFilteredSpanAnnotationNames(["note", "toxicity", "sentiment"])
      ).toEqual(["toxicity", "sentiment"]);
    });

    it("preserves non-note annotation names in order", () => {
      expect(getFilteredSpanAnnotationNames(["toxicity", "sentiment"])).toEqual(
        ["toxicity", "sentiment"]
      );
    });
  });

  describe("getVisibleSpanAnnotationColumnNames", () => {
    it("returns only visible filtered annotation names in server order", () => {
      expect(
        getVisibleSpanAnnotationColumnNames({
          spanAnnotationNames: ["note", "toxicity", "sentiment"],
          annotationColumnVisibility: {
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
          annotationColumnVisibility: {
            toxicity: false,
            sentiment: true,
          },
        })
      ).toEqual(["sentiment"]);
    });
  });
});
