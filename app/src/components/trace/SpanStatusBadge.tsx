import { css } from "@emotion/react";

import { Badge, Text } from "@phoenix/components";
import type { BadgeVariant } from "@phoenix/components/core/badge/types";
import type { TextColorValue } from "@phoenix/components/core/types/style";
import { assertUnreachable } from "@phoenix/typeUtils";

import type { SpanStatusCodeType } from "./types";

function getStatusVariant(statusCode: SpanStatusCodeType): BadgeVariant {
  switch (statusCode) {
    case "OK":
      return "success";
    case "ERROR":
      return "danger";
    case "UNSET":
      return "default";
    default:
      return assertUnreachable(statusCode);
  }
}

function getStatusTextColor(
  statusCode: SpanStatusCodeType,
  labelVariant: "full" | "short"
): TextColorValue {
  switch (statusCode) {
    case "OK":
      return "success";
    case "ERROR":
      return "danger";
    case "UNSET":
      return labelVariant === "short" ? "text-300" : "text-700";
    default:
      return assertUnreachable(statusCode);
  }
}

function getStatusLabel(
  statusCode: SpanStatusCodeType,
  labelVariant: "full" | "short"
): string {
  switch (statusCode) {
    case "OK":
      return "OK";
    case "ERROR":
      return labelVariant === "full" ? "Error" : "ERR";
    case "UNSET":
      return labelVariant === "full" ? "Unset" : "––";
    default:
      return assertUnreachable(statusCode);
  }
}

type SpanStatusBadgeVariant = "default" | "bare";

export function SpanStatusBadge({
  statusCode,
  variant = "default",
  labelVariant = "short",
}: {
  statusCode: SpanStatusCodeType;
  variant?: SpanStatusBadgeVariant;
  labelVariant?: "full" | "short";
}) {
  const label = getStatusLabel(statusCode, labelVariant);

  if (variant === "bare") {
    return (
      <Text
        size="S"
        color={getStatusTextColor(statusCode, labelVariant)}
        css={css`
          font-weight: 500;
        `}
      >
        {label}
      </Text>
    );
  }

  return (
    <Badge
      variant={getStatusVariant(statusCode)}
      size="M"
      css={css`
        height: var(--global-dimension-size-250);
        padding: 0 var(--global-dimension-size-75);
        border-radius: var(--global-rounding-small);
        font-size: var(--global-dimension-font-size-75);
        line-height: var(--global-line-height-xs);
        ${statusCode === "UNSET"
          ? "--badge-base-color: var(--global-color-gray-400);"
          : ""}
      `}
    >
      {label}
    </Badge>
  );
}
