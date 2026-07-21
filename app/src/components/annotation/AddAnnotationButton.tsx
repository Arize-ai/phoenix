import { css } from "@emotion/react";
import { Button as AriaButton } from "react-aria-components";

import { Icon, Icons } from "@phoenix/components";

const addAnnotationButtonCSS = css`
  flex: none;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--global-dimension-size-50);
  height: 24px;
  padding: 0 var(--global-dimension-size-100);
  border: 1px solid transparent;
  border-radius: var(--global-rounding-small);
  background-color: transparent;
  color: var(--global-text-color-700);
  font-size: var(--global-font-size-xs);
  cursor: pointer;
  transition:
    background-color 0.2s,
    color 0.2s;
  &[data-bordered="true"] {
    border-color: var(--global-border-color-default);
  }
  &[data-hovered] {
    background-color: var(--global-color-gray-200);
    color: var(--global-text-color-900);
  }
  &[data-focus-visible] {
    outline: 1px solid var(--global-input-field-border-color-active);
    outline-offset: 1px;
  }
  .icon-wrap {
    font-size: 13px;
  }
`;

type AddAnnotationButtonProps = {
  /**
   * Called when the user presses the button
   */
  onPress?: () => void;
  /**
   * When true, the button gets a visible border for extra affordance
   * (e.g. in an empty state)
   */
  bordered?: boolean;
};

/**
 * A ghost button that sits at the trailing edge of a row of annotation
 * tokens and invites the user to add an annotation.
 */
export function AddAnnotationButton({
  onPress,
  bordered = false,
}: AddAnnotationButtonProps) {
  return (
    <AriaButton
      css={addAnnotationButtonCSS}
      data-bordered={bordered}
      onPress={onPress}
      aria-label="Add annotation"
    >
      <Icon svg={<Icons.Plus />} />
      Annotation
    </AriaButton>
  );
}
