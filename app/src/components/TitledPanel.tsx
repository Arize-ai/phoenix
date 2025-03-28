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
  }>
>(
  (
    { children, title, panelProps, panelResizeHandleProps, resizable = false },
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
      if (panel?.getSize() === 0) {
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
            css={css(
              compactResizeHandleCSS,
              css`
                border-radius: var(--ac-global-rounding-small);
                opacity: 0;
                &:hover,
                &:focus,
                &:active,
                &:focus-visible {
                  background-color: var(--ac-global-color-grey-200);
                  opacity: 1;
                }
                &:not([data-resize-handle-state="drag"]) + [data-panel] {
                  transition: flex 0.2s ease-in-out;
                }
              `
            )}
          />
        )}
        <PanelTitle onClick={handleClick} collapsed={collapsed}>
          {title}
        </PanelTitle>
        <Panel
          minSize={0}
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
  &:hover {
    cursor: pointer;
  }
  &:hover[disabled] {
    cursor: default;
  }
  display: flex;
  align-items: center;
  padding: var(--ac-global-dimension-size-50) 0;
  font-weight: var(--px-font-weight-heavy);
  font-size: var(--ac-global-font-size-s);
`;

export const PanelTitle = ({
  children,
  collapsed,
  ...props
}: {
  children: React.ReactNode;
  collapsed?: boolean;
} & React.HTMLProps<HTMLButtonElement>) => {
  return (
    <button
      {...props}
      type="button"
      data-collapsed={collapsed}
      css={panelTitleCSS}
      disabled={collapsed === undefined}
    >
      {collapsed !== undefined && (
        <Icon
          data-collapsed={collapsed}
          svg={<Icons.ChevronDown />}
          css={css`
            font-size: var(--ac-global-font-size-xl);
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
