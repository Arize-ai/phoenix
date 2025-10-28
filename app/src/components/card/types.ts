import { PropsWithChildren } from "react";

import { ViewStyleProps } from "@phoenix/components/types";

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
}
