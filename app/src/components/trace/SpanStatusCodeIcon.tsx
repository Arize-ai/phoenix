import { Icon, Icons } from "@phoenix/components";
import { assertUnreachable } from "@phoenix/typeUtils";

import type { SpanStatusCodeType } from "./types";
import { useSpanStatusCodeColor } from "./useSpanStatusCodeColor";

export function SpanStatusCodeIcon<TCode extends SpanStatusCodeType>({
  statusCode,
  ...restProps
}: {
  statusCode: TCode;
}) {
  let iconSVG = <Icons.Minus />;
  const color = useSpanStatusCodeColor(statusCode);
  switch (statusCode) {
    case "OK":
      iconSVG = <Icons.Checkmark />;
      break;
    case "ERROR":
      iconSVG = <Icons.AlertCircle />;
      break;
    case "UNSET":
      iconSVG = <Icons.Minus />;
      break;
    default:
      assertUnreachable(statusCode);
  }
  return (
    <Icon svg={iconSVG} color={color} aria-label={statusCode} {...restProps} />
  );
}
