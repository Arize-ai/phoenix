import type { TokenProps } from "@phoenix/components/core/token";
import { Token } from "@phoenix/components/core/token";

import { getSpanKindColor } from "./spanKindColor";

export function SpanKindToken(props: {
  spanKind: string;
  size?: TokenProps["size"];
}) {
  const { spanKind, size = "M" } = props;
  return (
    <Token color={getSpanKindColor({ spanKind })} size={size}>
      {spanKind}
    </Token>
  );
}
