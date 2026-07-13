import type { PropsWithChildren } from "react";

import type { ViewStyleProps } from "@phoenix/components/core/types";

export interface CardProps extends PropsWithChildren<ViewStyleProps> {
  /**
   * The title of the card, displayed in the card header.
   */
  title?: string | React.ReactNode;
  /**
   * Additional content displayed directly to the right of the title.
   */
  titleExtra?: React.ReactNode;
  /**
   * Whether to show a separator between the card header and the card body.
   * @default true
   */
  titleSeparator?: boolean;
  /**
   * The subtitle of the card, displayed below the title.
   */
  subTitle?: string;
  /**
   * Whether the card body can be collapsed.
   * @default false
   */
  collapsible?: boolean;
  /**
   * Whether the card body is open by default. Only applicable if `collapsible` is `true`.
   * @default true
   */
  defaultOpen?: boolean;
  /**
   * Set when the title contains interactive elements (selects, buttons, etc.).
   * The collapse toggle then renders as a standalone arrow button beside the
   * title instead of wrapping it, so interactive controls are not nested
   * inside a button. Only applicable if `collapsible` is `true`.
   * @default false
   */
  interactiveTitle?: boolean;
  /**
   * Accessible name for the collapse toggle. Recommended with `interactiveTitle`,
   * where the toggle is a bare arrow: naming it from the title subtree would pick
   * up the accessible name of the title's own control (e.g. a select), which is
   * both wrong and identical across cards.
   */
  collapseButtonLabel?: string;
  /**
   * Additional content displayed on the right side of the card header.
   */
  extra?: React.ReactNode;
  /**
   * Whether to enable scrolling for the card body.
   * @default false
   */
  scrollBody?: boolean;
  /**
   * Callback fired when the card is collapsed or expanded. Only applicable if `collapsible` is `true`.
   */
  onCollapseChange?: (isCollapsed: boolean) => void;
  /**
   * Forwarded to the root `<section>` element as `data-testid`.
   */
  testId?: string;
}
