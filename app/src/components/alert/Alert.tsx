import { ReactNode, SyntheticEvent } from "react";
import { css } from "@emotion/react";

import { useTheme } from "@phoenix/contexts";

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
  --alert-base-color: var(--ac-global-color-info);
  --alert-bg-color: lch(from var(--alert-base-color) l c h / 0.1);
  --alert-border-color: lch(from var(--alert-base-color) l c h / 0.3);
  --alert-text-color: lch(
    from var(--alert-base-color) calc((50 - l) * infinity) 0 0
  );

  padding: var(--ac-global-dimension-static-size-100)
    var(--ac-global-dimension-static-size-200);
  border-radius: var(--ac-global-rounding-small);
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
    --alert-base-color: var(--ac-global-color-warning);
  }

  &[data-variant="info"] {
    --alert-base-color: var(--ac-global-color-info);
  }

  &[data-variant="danger"] {
    --alert-base-color: var(--ac-global-color-danger);
  }

  &[data-variant="success"] {
    --alert-base-color: var(--ac-global-color-success);
  }

  &[data-theme="light"] {
    --alert-bg-color: lch(from var(--alert-base-color) l c h / 0.1);
    --alert-border-color: lch(from var(--alert-base-color) l c h / 0.3);
    --alert-text-color: var(--alert-base-color);
  }

  &[data-theme="dark"] {
    --alert-bg-color: lch(from var(--alert-base-color) l c h / 0.2);
    --alert-border-color: lch(from var(--alert-base-color) l c h / 0.4);
    --alert-text-color: lch(
      from var(--alert-base-color) calc((l) * infinity) c h / 1
    );
  }

  .ac-alert__icon-title-wrap {
    display: flex;
    flex-direction: row;

    .ac-icon-wrap {
      margin-top: 4px;
      margin-right: var(--ac-global-dimension-static-size-200);
      font-size: var(--ac-global-font-size-l);
    }
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
  const { theme } = useTheme();

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
      data-theme={theme}
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
