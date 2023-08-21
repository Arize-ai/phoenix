import React from "react";
import { css, Theme } from "@emotion/react";

import { Icon, Icons } from "@arizeai/components";

import { assertUnreachable } from "@phoenix/typeUtils";

import { SpanStatusCodeType } from "./types";

export function SpanStatusCodeIcon<TCode extends SpanStatusCodeType>({
  statusCode,
}: {
  statusCode: TCode;
}) {
  let icon = <Icons.MinusCircleOutline />;
  let color: keyof Theme["colors"] = "gray100";
  switch (statusCode) {
    case "OK":
      icon = <Icons.CheckmarkCircleOutline />;
      color = "statusSuccess";
      break;
    case "ERROR":
      icon = <Icons.AlertCircleOutline />;
      color = "statusDanger";
      break;
    case "UNSET":
      icon = <Icons.MinusCircleOutline />;
      break;
    default:
      assertUnreachable(statusCode);
  }
  return (
    <div
      css={(theme) => css`
        .ac-icon-wrap {
          color: ${theme.colors[color]};
        }
      `}
      aria-label={statusCode}
    >
      <Icon svg={icon} />
    </div>
  );
}
