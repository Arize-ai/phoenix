import React from "react";

import { ColorValue, Icon, Icons } from "@arizeai/components";

import { assertUnreachable } from "@phoenix/typeUtils";

import { SpanStatusCodeType } from "./types";

export function SpanStatusCodeIcon<TCode extends SpanStatusCodeType>({
  statusCode,
}: {
  statusCode: TCode;
}) {
  let iconSVG = <Icons.MinusCircleOutline />;
  let color: ColorValue = "grey-100";
  switch (statusCode) {
    case "OK":
      iconSVG = <Icons.CheckmarkCircleOutline />;
      color = "success";
      break;
    case "ERROR":
      iconSVG = <Icons.AlertCircleOutline />;
      color = "danger";
      break;
    case "UNSET":
      iconSVG = <Icons.MinusCircleOutline />;
      break;
    default:
      assertUnreachable(statusCode);
  }
  return <Icon svg={iconSVG} color={color} aria-label={statusCode} />;
}
