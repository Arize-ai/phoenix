import { css } from "@emotion/react";
import type { PropsWithChildren } from "react";
import { Pressable } from "react-aria";
import { TooltipTrigger } from "react-aria-components";

import { Button, ExternalLinkButton } from "../button";
import { Icon, Icons } from "../icon";
import { Tooltip } from "./Tooltip";
import type { TooltipProps } from "./types";

const getIconByVariant = (variant: ContextualHelpProps["variant"]) => {
  switch (variant) {
    case "info":
      return <Icons.Info />;
    case "help":
    default:
      return <Icons.Question />;
  }
};

const contextualHelpTriggerCSS = css`
  & {
    all: unset;
    height: 14px !important;
    width: 14px !important;
    padding: var(--global-dimension-size-50) !important;
    border-radius: var(--global-rounding-small);
    cursor: pointer;
    svg {
      height: 14px;
      width: 14px;
    }
  }
`;

export type ContextualHelpProps = PropsWithChildren<
  {
    href?: string;
    triggerAriaLabel?: string;
    variant?: "help" | "info";
  } & Partial<Omit<TooltipProps, "children">>
>;

export const ContextualHelp = ({
  children,
  href,
  triggerAriaLabel = "More information",
  variant = "help",
  ...tooltipProps
}: ContextualHelpProps) => {
  const triggerProps = {
    "aria-label": triggerAriaLabel,
    css: contextualHelpTriggerCSS,
    leadingVisual: <Icon svg={getIconByVariant(variant)} />,
    size: "S" as const,
    variant: "quiet" as const,
  };
  return (
    <TooltipTrigger delay={0}>
      {href ? (
        <Pressable>
          <ExternalLinkButton {...triggerProps} href={href} />
        </Pressable>
      ) : (
        <Button {...triggerProps} />
      )}
      <Tooltip {...tooltipProps}>{children}</Tooltip>
    </TooltipTrigger>
  );
};
