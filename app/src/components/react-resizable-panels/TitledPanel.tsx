import React, {
  forwardRef,
  PropsWithChildren,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  ImperativePanelHandle,
  Panel,
  PanelProps,
  PanelResizeHandle,
  PanelResizeHandleProps,
} from "react-resizable-panels";
import { css } from "@emotion/react";

import { Icon, Icons } from "@phoenix/components";
import { compactResizeHandleCSS } from "@phoenix/components/resize";

/**
 * A panel with a title that can be collapsed and expanded.
 *
 * Add `resizable` prop to make the panel resizable with an automatically added handle.
 * The first TitledPanel in a PanelGroup SHOULD NOT be resizable or things will break.
 */
export const TitledPanel = forwardRef<
  ImperativePanelHandle | null,
  PropsWithChildren<{
    title: React.ReactNode;
    panelProps?: PanelProps;
    panelResizeHandleProps?: PanelResizeHandleProps;
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
    const panelRef = useRef<ImperativePanelHandle | null>(null);
    useImperativeHandle<
      ImperativePanelHandle | null,
      ImperativePanelHandle | null
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
          <PanelResizeHandle
            {...panelResizeHandleProps}
            data-bordered={bordered}
            css={css(
              compactResizeHandleCSS,
              css`
                border-radius: var(--ac-global-rounding-small);
                opacity: 1;
                background-color: unset;
                &[data-bordered="true"] {
                  background-color: var(--ac-global-border-color-default);
                }
                &[data-panel-group-direction="vertical"] {
                  height: 1px;
                }
                &:hover,
                &:focus,
                &:active,
                &:focus-visible {
                  // Make hover target bigger
                  background-color: var(--ac-global-color-primary);
                }
                &:not([data-resize-handle-state="drag"]) ~ [data-panel] {
                  // transition: flex 0.2s ease-in-out;
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
          maxSize={100}
          {...panelProps}
          ref={panelRef}
          collapsible
          onCollapse={() => {
            setCollapsed(true);
            panelProps?.onCollapse?.();
          }}
          onExpand={() => {
            setCollapsed(false);
            panelProps?.onExpand?.();
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
    background-color: var(--ac-global-input-field-background-color-active);
  }
  &:hover[disabled] {
    cursor: default;
    background-color: unset;
  }
  &[disabled] {
    opacity: var(--ac-opacity-disabled);
  }
  display: flex;
  align-items: center;
  gap: var(--ac-global-dimension-size-100);
  padding: var(--ac-global-dimension-size-100)
    var(--ac-global-dimension-size-50);
  font-weight: var(--px-font-weight-heavy);
  font-size: var(--ac-global-font-size-s);
  &[data-bordered="true"] {
    border-bottom: 1px solid var(--ac-global-border-color-default);
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
