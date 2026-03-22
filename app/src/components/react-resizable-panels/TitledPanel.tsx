import { css } from "@emotion/react";
import type { PropsWithChildren } from "react";
import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type {
  PanelImperativeHandle,
  PanelProps,
  SeparatorProps,
} from "react-resizable-panels";
import { Panel, Separator } from "react-resizable-panels";

import { Icon, Icons } from "@phoenix/components";
import { compactResizeHandleCSS } from "@phoenix/components/resize";

/**
 * A panel with a title that can be collapsed and expanded.
 *
 * Add `resizable` prop to make the panel resizable with an automatically added handle.
 * The first TitledPanel in a Group SHOULD NOT be resizable or things will break.
 */
export const TitledPanel = forwardRef<
  PanelImperativeHandle | null,
  PropsWithChildren<{
    title: React.ReactNode;
    panelProps?: Omit<PanelProps, "onResize">;
    panelResizeHandleProps?: SeparatorProps;
    resizable?: boolean;
    bordered?: boolean;
    disabled?: boolean;
  }>
>(
  (
    {
      children,
      title,
      panelProps,
      panelResizeHandleProps,
      resizable = false,
      bordered = true,
      disabled,
    },
    ref
  ) => {
    const panelRef = useRef<PanelImperativeHandle | null>(null);
    useImperativeHandle<
      PanelImperativeHandle | null,
      PanelImperativeHandle | null
    >(ref, () => panelRef.current);
    const [collapsed, setCollapsed] = useState(false);

    const handleClick = () => {
      const panel = panelRef.current;
      if (panel?.isCollapsed()) {
        panel?.expand();
      } else {
        panel?.collapse();
      }
    };

    return (
      <>
        {resizable && (
          <Separator
            {...panelResizeHandleProps}
            data-bordered={bordered}
            css={css(
              compactResizeHandleCSS,
              css`
                border-radius: var(--global-rounding-small);
                opacity: 1;
                background-color: unset;
                &[data-bordered="true"] {
                  background-color: var(--global-border-color-default);
                }
                &[aria-orientation="horizontal"] {
                  height: 1px;
                }
                &:hover,
                &:focus,
                &:active,
                &:focus-visible {
                  // Make hover target bigger
                  background-color: var(--global-color-primary);
                }
              `
            )}
          />
        )}
        <PanelTitle
          onClick={handleClick}
          collapsed={collapsed}
          bordered={bordered}
          disabled={disabled}
        >
          {title}
        </PanelTitle>
        <Panel
          maxSize="100%"
          {...panelProps}
          panelRef={panelRef}
          collapsible
          onResize={(panelSize) => {
            const isCollapsed = panelSize.asPercentage === 0;
            setCollapsed((prev) => (prev === isCollapsed ? prev : isCollapsed));
          }}
        >
          {children}
        </Panel>
      </>
    );
  }
);

TitledPanel.displayName = "TitledPanel";

const panelTitleCSS = css`
  all: unset;
  width: 100%;
  &:hover {
    cursor: pointer;
    background-color: var(--global-card-header-background-color-hover);
  }
  &:hover[disabled] {
    cursor: default;
    background-color: unset;
  }
  &[disabled] {
    opacity: var(--global-opacity-disabled);
  }
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  padding: var(--global-dimension-size-100) var(--global-dimension-size-50);
  font-weight: var(--font-weight-heavy);
  font-size: var(--global-font-size-s);
  &[data-bordered="true"] {
    border-bottom: 1px solid var(--global-border-color-default);
  }
  &[data-collapsed="true"] {
    border-bottom: none;
  }
`;

export const PanelTitle = ({
  children,
  collapsed,
  bordered,
  disabled,
  ...props
}: {
  children: React.ReactNode;
  collapsed?: boolean;
  bordered?: boolean;
  disabled?: boolean;
} & React.HTMLProps<HTMLButtonElement>) => {
  return (
    <button
      {...props}
      type="button"
      data-collapsed={collapsed}
      data-bordered={bordered}
      css={panelTitleCSS}
      disabled={collapsed === undefined || disabled}
    >
      {collapsed !== undefined && (
        <Icon
          data-collapsed={collapsed}
          svg={<Icons.ArrowIosDownwardOutline />}
          css={css`
            transition: transform 0.2s ease-in-out;
            &[data-collapsed="true"] {
              transform: rotate(-90deg);
            }
          `}
        />
      )}
      {children}
    </button>
  );
};
