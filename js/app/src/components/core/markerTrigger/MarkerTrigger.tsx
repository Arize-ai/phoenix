import { css } from "@emotion/react";
import type { ReactNode, Ref } from "react";
import { useState } from "react";
import type { ButtonProps as AriaButtonProps } from "react-aria-components";
import { Button as AriaButton } from "react-aria-components";

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
   * The marker that is the trigger's whole visible face, such as a
   * `StatusIndicator`, or a row of markers that are one fact together, such
   * as where a credential is set.
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
};

export type MarkerTriggerProps = MarkerTriggerBaseProps &
  (ActionProps | ExplanationProps);

const markerTriggerCSS = css`
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-size-150);
  min-width: 0;
  max-width: 100%;
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  color: inherit;
  border-radius: var(--global-rounding-small);
  cursor: pointer;
  outline: none;

  &[data-explanation] {
    cursor: help;
  }
  &[data-focus-visible] {
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
 *
 * Use it only when its markers are the trigger's whole visible face. A
 * trigger takes one action; a second belongs in a menu.
 */
export function MarkerTrigger(props: MarkerTriggerProps) {
  if (props.explanation !== undefined) {
    return <ExplainingMarkerTrigger {...props} />;
  }
  const { ref, ...buttonProps } = props;
  return (
    <AriaButton
      {...buttonProps}
      ref={ref}
      className="marker-trigger"
      css={markerTriggerCSS}
    />
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
