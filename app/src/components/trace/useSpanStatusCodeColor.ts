import { ColorValue } from "@arizeai/components";

import { assertUnreachable } from "@phoenix/typeUtils";

import { SpanStatusCodeType } from "./types";

export function useSpanStatusCodeColor(
  statusCode: SpanStatusCodeType
): ColorValue {
  switch (statusCode) {
    case "OK":
      return "success";

    case "ERROR":
      return "danger";
      break;
    case "UNSET":
      return "grey-500";
    default:
      assertUnreachable(statusCode);
  }
}
