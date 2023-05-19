import { assertUnreachable } from "@phoenix/typeUtils";

/**
 * A object type to represent the graphql bin types
 */
type GqlBin =
  | {
      readonly __typename: "IntervalBin";
      readonly range: {
        readonly end: number;
        readonly start: number;
      };
    }
  | {
      readonly __typename: "MissingValueBin";
    }
  | {
      readonly __typename: "NominalBin";
      readonly name: string;
    }
  | {
      readonly __typename: "%other";
    };

/**
 * Formats each bin into a string for charting
 * @param bin
 * @returns
 */
export function getBinName(bin: GqlBin): string {
  const binType = bin.__typename;
  switch (binType) {
    case "NominalBin":
      return bin.name;
    case "IntervalBin":
      // TODO(mikeldking) - add a general case number formatter
      return `${bin.range.start} - ${bin.range.end}`;
    case "MissingValueBin":
      return "(empty)";
    case "%other":
      throw new Error("Unexpected bin type %other");
    default:
      assertUnreachable(binType);
  }
}
