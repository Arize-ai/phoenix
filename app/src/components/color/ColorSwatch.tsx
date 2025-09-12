import { css } from "@emotion/react";

import { SizingProps } from "@phoenix/components/types";

type ColorSwatchShape = "square" | "circle";

export function ColorSwatch({
  color,
  size = "M",
  shape = "square",
}: { color: string; shape?: ColorSwatchShape } & SizingProps) {
  return (
    <span
      data-shape={shape}
      data-size={size}
      css={css`
        background-color: ${color};
        display: inline-block;

        &[data-shape="square"] {
          border-radius: 2px;
        }

        &[data-shape="circle"] {
          border-radius: 50%;
        }

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
