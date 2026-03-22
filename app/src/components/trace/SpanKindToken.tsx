import type { TokenProps } from "@phoenix/components/core/token";
import { Token } from "@phoenix/components/core/token";

import { useSpanKindColor } from "./useSpanKindColor";

export function SpanKindToken(props: {
  spanKind: string;
  size?: TokenProps["size"];
}) {
  const { spanKind, size = "M" } = props;
  const color = useSpanKindColor({ spanKind });
  return (
    <Token color={color} size={size}>
      {spanKind}
    </Token>
  );
}
