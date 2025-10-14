import { PropsWithChildren } from "react";
import { TooltipTrigger } from "react-aria-components";
import { css } from "@emotion/react";

import {
  Button,
  Icon,
  Icons,
  Tooltip,
  TooltipProps,
} from "@phoenix/components";

const getIconByVariant = (variant: ContextualHelpProps["variant"]) => {
  switch (variant) {
    case "info":
      return <Icons.InfoOutline />;
    case "help":
    default:
      return <Icons.QuestionOutline />;
  }
};

export type ContextualHelpProps = PropsWithChildren<
  {
    variant?: "help" | "info";
  } & Partial<Omit<TooltipProps, "children">>
>;

export const ContextualHelp = ({
  children,
  variant = "help",
  ...tooltipProps
}: ContextualHelpProps) => {
  return (
    <TooltipTrigger delay={0}>
      <Button
        // Special case styling to maintain compatability with arizeai/components contextual help
        css={css`
          & {
            all: unset;
            height: 14px !important;
            width: 14px !important;
            padding: var(--ac-global-dimension-size-50) !important;
            border-radius: var(--ac-global-rounding-small);
            svg {
              height: 14px;
              width: 14px;
            }
          }
        `}
        variant="quiet"
        size="S"
        leadingVisual={<Icon svg={getIconByVariant(variant)} />}
      />
      <Tooltip {...tooltipProps}>{children}</Tooltip>
    </TooltipTrigger>
  );
};
