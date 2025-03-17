import React, { ReactNode, SyntheticEvent } from "react";
import { css } from "@emotion/react";

import { classNames } from "@phoenix/components";

import { Text } from "../content";
import { CloseOutline, Icon } from "../icon";
import { SeverityLevel } from "../types";

import { getSeverityIcon } from "./getSeverityIcon";
import { useSeverityStyle } from "./useSeverityStyle";
export interface AlertProps {
  variant: SeverityLevel;
  children?: ReactNode;
  /**
   * Title of the alert. Optional
   */
  title?: ReactNode;
  /**
   * A custom icon to show
   */
  icon?: ReactNode;
  /**
   * Whether or not an icon is shown on the left
   * @default true
   */
  showIcon?: boolean;
  /**
   * If set to true, a close button is rendered
   * @default false
   */
  dismissable?: boolean;
  /**
   * dismiss callback
   */
  onDismissClick?: (e: SyntheticEvent<HTMLButtonElement>) => void;
  /**
   * If set to true, this alert is being placed at the top of a page
   * @default false
   */
  banner?: boolean;
  /**
   * Extra content (typically a button) added to the alert
   */
  extra?: ReactNode;
}

export const Alert = ({
  variant,
  title,
  icon,
  children,
  showIcon = true,
  dismissable = false,
  onDismissClick,
  banner = false,
  extra,
  ...otherProps
}: AlertProps) => {
  const variantStyle = useSeverityStyle(variant);

  if (!icon && showIcon) {
    icon = getSeverityIcon(variant);
  }
  return (
    <div
      {...otherProps}
      css={css`
        padding: var(--ac-global-dimension-static-size-100)
          var(--ac-global-dimension-static-size-200);
        border-radius: 4px;
        color: var(--ac-global-text-color-900);
        display: flex;
        flex-direction: row;
        align-items: center;
        &.ac-alert--banner {
          border-radius: 0;
          border-left: 0px;
          border-right: 0px;
        }
        ${variantStyle}
        .ac-alert__icon-title-wrap .ac-icon-wrap {
          margin-right: var(--ac-global-dimension-static-size-200);
          font-size: var(--ac-global-dimension-font-size-300);
          margin-top: 2px;
        }
        &.ac-alert--with-title .ac-alert__icon-title-wrap .ac-icon-wrap {
          /* The line height with the title is different so accommodate for it */
          margin-top: 3px;
        }
      `}
      className={classNames(
        "ac-alert",
        title ? "ac-alert--with-title" : null,
        banner ? "ac-alert--banner" : null
      )}
    >
      <div
        className="ac-alert__icon-title-wrap"
        css={css`
          display: flex;
          flex-direction: row;
          align-items: flex-start;
          flex: 1 1 auto;
        `}
      >
        {icon}
        <div>
          {title ? (
            <Text elementType="h5" size="L" weight="heavy" color="inherit">
              {title}
            </Text>
          ) : null}
          <Text color="inherit" size="M">
            {children}
          </Text>
        </div>
      </div>
      {extra}
      {dismissable ? (
        <button
          css={css`
            background-color: transparent;
            color: inherit;
            padding: 0;
            border: none;
            cursor: pointer;
            width: 20px;
            height: 20px;
            margin-left: var(--ac-global-dimension-static-size-200);
          `}
          onClick={onDismissClick}
        >
          {<Icon svg={<CloseOutline />} />}
        </button>
      ) : null}
    </div>
  );
};
