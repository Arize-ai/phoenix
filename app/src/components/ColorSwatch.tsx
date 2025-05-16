import { css } from "@emotion/react";

import { SizingProps } from "@phoenix/components/types";

export function ColorSwatch({
  color,
  size = "M",
}: { color: string } & SizingProps) {
  return (
    <span
      data-size={size}
      css={css`
        background-color: ${color};
        display: inline-block;
        border-radius: 2px;

        &[data-size="S"] {
          width: 0.4rem;
          height: 0.4rem;
        }

        &[data-size="M"] {
          width: 0.6rem;
          height: 0.6rem;
        }

        &[data-size="L"] {
          width: 1rem;
          height: 1rem;
        }
      `}
    />
  );
}
