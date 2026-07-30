import { formatFloat } from "@phoenix/utils/numberFormatUtils";

/** Formats annotation scores without unnecessary trailing fractional zeros. */
export function formatAnnotationScore(score: number): string {
  const formattedScore = formatFloat(score);
  if (formattedScore.includes("e")) {
    return formattedScore;
  }
  return formattedScore.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
}
