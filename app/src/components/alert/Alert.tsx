import React, { ReactNode, SyntheticEvent } from "react";
import { css } from "@emotion/react";

import { Text } from "../content";
import { CloseOutline, Icon } from "../icon";
import { SeverityLevel } from "../types";

import { getSeverityIcon } from "./getSeverityIcon";

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

const alertCSS = css`
  --alert-border-color: var(--ac-global-color-info);
  --alert-bg-color: var(--ac-global-color-info-700);
  --alert-text-color: var(--ac-global-static-color-white-900);

  padding: var(--ac-global-dimension-static-size-100)
    var(--ac-global-dimension-static-size-200);
  border-radius: var(--ac-global-rounding-medium);
  color: var(--alert-text-color);
  display: flex;
  flex-direction: row;
  align-items: center;
  backdrop-filter: blur(10px);
  border: 1px solid var(--alert-border-color);
  background-color: var(--alert-bg-color);

  &[data-banner="true"] {
    border-radius: 0;
    border-left: 0px;
    border-right: 0px;
  }

  &[data-variant="warning"] {
    --alert-border-color: var(--ac-global-color-warning);
    --alert-bg-color: var(--ac-global-color-warning-700);
  }

  &[data-variant="info"] {
    --alert-border-color: var(--ac-global-color-info);
    --alert-bg-color: var(--ac-global-color-info-700);
  }

  &[data-variant="danger"] {
    --alert-border-color: var(--ac-global-color-danger);
    --alert-bg-color: var(--ac-global-color-danger-700);
  }

  &[data-variant="success"] {
    --alert-border-color: var(--ac-global-color-success);
    --alert-bg-color: var(--ac-global-color-success-700);
  }

  .ac-alert__icon-title-wrap .ac-icon-wrap {
    margin-right: var(--ac-global-dimension-static-size-200);
    font-size: var(--ac-global-dimension-font-size-300);
    margin-top: 2px;
  }

  &[data-has-title="true"] .ac-alert__icon-title-wrap .ac-icon-wrap {
    margin-top: 3px;
  }
`;

const iconTitleWrapCSS = css`
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  flex: 1 1 auto;
`;

const dismissButtonCSS = css`
  background-color: transparent;
  color: inherit;
  padding: 0;
  border: none;
  cursor: pointer;
  width: 20px;
  height: 20px;
  margin-left: var(--ac-global-dimension-static-size-200);
`;

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
  if (!icon && showIcon) {
    icon = getSeverityIcon(variant);
  }

  return (
    <div
      {...otherProps}
      css={alertCSS}
      data-variant={variant}
      data-banner={banner}
      data-has-title={!!title}
    >
      <div css={iconTitleWrapCSS} className="ac-alert__icon-title-wrap">
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
        <button css={dismissButtonCSS} onClick={onDismissClick}>
          {<Icon svg={<CloseOutline />} />}
        </button>
      ) : null}
    </div>
  );
};
