import { css } from "@emotion/react";
import type { ReactNode, Ref } from "react";
import { createContext, useContext, useState } from "react";
import { Focusable, mergeProps, useHover } from "react-aria";
import type { ButtonProps as AriaButtonProps } from "react-aria-components";
import { Button as AriaButton } from "react-aria-components";
import { Link as RouterLink } from "react-router";

import {
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components/core/tooltip";

type MarkerTriggerBaseProps = Omit<
  AriaButtonProps,
  "className" | "style" | "children" | "onPress"
> & {
  /**
   * The one marker that is the trigger's whole visible face, such as a
   * `StatusIndicator`.
   */
  children: ReactNode;
  ref?: Ref<HTMLButtonElement>;
};

type ActionProps = {
  /**
   * What pressing the marker does: open its detail, apply a filter. Omit it
   * when an enclosing `DialogTrigger` or `MenuTrigger` supplies the press.
   */
  onPress?: AriaButtonProps["onPress"];
  /**
   * Required: the marker's own text rarely says what pressing it does.
   */
  "aria-label": string;
  explanation?: never;
  href?: never;
};

type ExplanationProps = {
  /**
   * A short explanation of the marker, such as why a provider is
   * unavailable. It shows on hover and focus, and pressing the marker
   * toggles it, so touch and keyboard users can open it too. Keep it to
   * plain text; a tooltip holds nothing interactive.
   */
  explanation: ReactNode;
  /**
   * Optional: the marker's own text names the trigger, and the explanation
   * is announced as its description.
   */
  "aria-label"?: string;
  onPress?: never;
  href?: never;
};

type LinkMarkerTriggerProps = {
  children: ReactNode;
  /**
   * The route the marker opens. Unlike `onPress`, it opens in a new tab and
   * copies like any link.
   */
  href: string;
  /**
   * Required: the marker's own text rarely says where it leads.
   */
  "aria-label": string;
  /**
   * A short explanation of the marker, shown on hover and focus.
   */
  explanation?: ReactNode;
  onPress?: never;
  ref?: Ref<HTMLAnchorElement>;
};

export type MarkerTriggerProps =
  | (MarkerTriggerBaseProps & (ActionProps | ExplanationProps))
  | LinkMarkerTriggerProps;

const ExplainedByMarkerTriggerContext = createContext(false);

/**
 * Whether the marker is the face of a `MarkerTrigger` that shows an
 * explanation tooltip, so the marker should not add a native tooltip too.
 */
export function useIsExplainedByMarkerTrigger() {
  return useContext(ExplainedByMarkerTriggerContext);
}

const markerTriggerCSS = css`
  appearance: none;
  display: inline-flex;
  align-items: center;
  min-width: 0;
  max-width: 100%;
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  color: inherit;
  text-decoration: none;
  border-radius: var(--global-rounding-small);
  cursor: pointer;
  outline: none;

  &[data-explanation]:not(:any-link) {
    cursor: help;
  }
  &[data-focus-visible],
  &:any-link:focus-visible {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }
  &[data-disabled] {
    cursor: not-allowed;
  }
`;

/**
 * A visually inert button around one marker, for a status that opens
 * detail, does something, or carries an explanation. It draws nothing but
 * its focus ring: the marker inside draws its own hover and pressed state
 * from the trigger's state attributes, so the feedback is the marker's while
 * the hit target is the button's. The marker itself never handles an event.
 *
 * - **Action** (`aria-label`, with `onPress` or an enclosing
 *   `DialogTrigger` / `MenuTrigger`): pressing opens the marker's detail or
 *   acts on it, such as filtering a table to that status.
 * - **Explanation** (`explanation`): a tooltip on hover and focus that a
 *   press toggles. It stays a button, because assistive technology announces
 *   a tooltip only on an interactive element, and the press does something.
 * - **Link** (`href`, `aria-label`): the marker opens a page in the app. Use
 *   it instead of an `onPress` that navigates. It may also carry an
 *   `explanation`.
 *
 * Use it only when the marker is the trigger's whole visible face. A marker
 * takes one action; a second belongs in a menu.
 */
export function MarkerTrigger(props: MarkerTriggerProps) {
  let trigger: ReactNode;
  if (props.href !== undefined) {
    trigger = <LinkMarkerTrigger {...props} />;
  } else if (props.explanation !== undefined) {
    trigger = <ExplainingMarkerTrigger {...props} />;
  } else {
    const { ref, ...buttonProps } = props;
    trigger = (
      <AriaButton
        {...buttonProps}
        ref={ref}
        className="marker-trigger"
        css={markerTriggerCSS}
      />
    );
  }
  return (
    <ExplainedByMarkerTriggerContext.Provider
      value={props.explanation !== undefined}
    >
      {trigger}
    </ExplainedByMarkerTriggerContext.Provider>
  );
}

function stopPropagation(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

/**
 * A router link rather than an `AriaButton`: React Aria's `Link` would
 * navigate with a full page load, since the app has no React Aria
 * `RouterProvider`. It stops `pointerdown` and `click` itself, which
 * `usePress` does for the button forms, so a clickable row around it does not
 * also activate.
 */
function LinkMarkerTrigger({
  ref,
  href,
  explanation,
  children,
  "aria-label": ariaLabel,
}: LinkMarkerTriggerProps) {
  const { hoverProps, isHovered } = useHover({});
  const link = (
    <RouterLink
      {...mergeProps(hoverProps, {
        onClick: stopPropagation,
        onPointerDown: stopPropagation,
      })}
      ref={ref}
      to={href}
      aria-label={ariaLabel}
      className="marker-trigger"
      css={markerTriggerCSS}
      data-hovered={isHovered || undefined}
      data-explanation={explanation !== undefined || undefined}
    >
      {children}
    </RouterLink>
  );
  if (explanation === undefined) {
    return link;
  }
  return (
    <TooltipTrigger delay={500}>
      <Focusable>{link}</Focusable>
      <Tooltip>
        <TooltipArrow />
        {explanation}
      </Tooltip>
    </TooltipTrigger>
  );
}

function ExplainingMarkerTrigger({
  ref,
  explanation,
  ...buttonProps
}: MarkerTriggerBaseProps & ExplanationProps) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <TooltipTrigger
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      shouldCloseOnPress={false}
      delay={500}
    >
      <AriaButton
        {...buttonProps}
        ref={ref}
        className="marker-trigger"
        css={markerTriggerCSS}
        data-explanation
        onPress={() => setIsOpen((open) => !open)}
      />
      <Tooltip>
        <TooltipArrow />
        {explanation}
      </Tooltip>
    </TooltipTrigger>
  );
}
