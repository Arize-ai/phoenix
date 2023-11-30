import React from "react";

import { Icon, Icons } from "@arizeai/components";

import { assertUnreachable } from "@phoenix/typeUtils";

import { SpanStatusCodeType } from "./types";
import { useSpanStatusCodeColor } from "./useSpanStatusCodeColor";

export function SpanStatusCodeIcon<TCode extends SpanStatusCodeType>({
  statusCode,
}: {
  statusCode: TCode;
}) {
  let iconSVG = <Icons.MinusCircleOutline />;
  const color = useSpanStatusCodeColor(statusCode);
  switch (statusCode) {
    case "OK":
      iconSVG = <Icons.CheckmarkCircleOutline />;
      break;
    case "ERROR":
      iconSVG = <Icons.AlertCircleOutline />;
      break;
    case "UNSET":
      iconSVG = <Icons.MinusCircleOutline />;
      break;
    default:
      assertUnreachable(statusCode);
  }
  return <Icon svg={iconSVG} color={color} aria-label={statusCode} />;
}
