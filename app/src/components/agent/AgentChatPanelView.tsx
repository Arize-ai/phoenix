import { css } from "@emotion/react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import { useEffect, useId, useRef, useState } from "react";
import { Panel, Separator } from "react-resizable-panels";

import {
  Button,
  Flex,
  Icon,
  Icons,
  LinkButton,
  Text,
} from "@phoenix/components";
import { fadedDividerBottomCSS } from "@phoenix/components/core/layout";
import { NON_MODAL_FLOATING_Z_INDEX } from "@phoenix/components/core/zIndex";
import { compactResizeHandleCSS } from "@phoenix/components/resize/styles";
import type {
  AgentFabPlacement,
  AgentPosition,
  AgentSession,
} from "@phoenix/store/agentStore";
import type { Point, Size } from "@phoenix/types/geometry";

import { PxiGlyph } from "./PxiGlyph";
import { SessionListMenu } from "./SessionListMenu";

const PANEL_HEADER_Z_INDEX = 3;
const FLOATING_PANEL_WIDTH_PX = 420;
const FLOATING_PANEL_HEIGHT_PX = 720;
const FLOATING_PANEL_MIN_WIDTH_PX = 360;
const FLOATING_PANEL_MIN_HEIGHT_PX = 520;
const FLOATING_PANEL_FULLSCREEN_BREAKPOINT_PX = 600;
const FLOATING_PANEL_VIEWPORT_MARGIN = "var(--global-dimension-size-400)";
const FLOATING_PANEL_RESIZE_HANDLE_SIZE_PX = 6;
const FLOATING_PANEL_KEYBOARD_RESIZE_STEP_PX = 24;
const PRIMARY_POINTER_BUTTON = 0;

export const DEFAULT_FLOATING_AGENT_CHAT_SIZE: Size = {
  width: FLOATING_PANEL_WIDTH_PX,
  height: FLOATING_PANEL_HEIGHT_PX,
};

type FloatingPanelResizeAxis = "horizontal" | "vertical";

type FloatingPanelResizeEdge = "bottom" | "left" | "right" | "top";

type FloatingPanelResizeHandleConfig = {
  axis: FloatingPanelResizeAxis;
  edge: FloatingPanelResizeEdge;
};

type FloatingPanelResizeLimits = {
  maxHeight: number;
  maxWidth: number;
  minHeight: number;
  minWidth: number;
};

type FloatingPanelResizeSession = {
  axis: FloatingPanelResizeAxis;
  edge: FloatingPanelResizeEdge;
  limits: FloatingPanelResizeLimits;
  pointerId: number;
  startPointer: Point;
  startSize: Size;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getFloatingPanelResizeHandles(
  placement: AgentFabPlacement
): FloatingPanelResizeHandleConfig[] {
  return [
    {
      axis: "horizontal",
      edge: placement.endsWith("end") ? "left" : "right",
    },
    {
      axis: "vertical",
      edge: placement.startsWith("bottom") ? "top" : "bottom",
    },
  ];
}

function getFallbackResizeLimits(): FloatingPanelResizeLimits {
  const maxHeight =
    typeof window === "undefined"
      ? FLOATING_PANEL_HEIGHT_PX
      : window.innerHeight;
  const maxWidth =
    typeof window === "undefined" ? FLOATING_PANEL_WIDTH_PX : window.innerWidth;

  return {
    maxHeight,
    maxWidth,
    minHeight: Math.min(FLOATING_PANEL_MIN_HEIGHT_PX, maxHeight),
    minWidth: Math.min(FLOATING_PANEL_MIN_WIDTH_PX, maxWidth),
  };
}

function getFloatingPanelBoundaryRect(panel: HTMLElement): DOMRect {
  const boundary = panel.offsetParent ?? panel.parentElement;
  return boundary instanceof HTMLElement
    ? boundary.getBoundingClientRect()
    : new DOMRect(0, 0, window.innerWidth, window.innerHeight);
}

function getFloatingPanelResizeLimits(
  panel: HTMLElement | null,
  placement: AgentFabPlacement
): FloatingPanelResizeLimits {
  if (!panel) {
    return getFallbackResizeLimits();
  }

  const panelRect = panel.getBoundingClientRect();
  const boundaryRect = getFloatingPanelBoundaryRect(panel);
  const horizontalInset = placement.endsWith("end")
    ? Math.max(boundaryRect.right - panelRect.right, 0)
    : Math.max(panelRect.left - boundaryRect.left, 0);
  const verticalInset = placement.startsWith("bottom")
    ? Math.max(boundaryRect.bottom - panelRect.bottom, 0)
    : Math.max(panelRect.top - boundaryRect.top, 0);
  const maxWidth = Math.max(
    placement.endsWith("end")
      ? panelRect.right - boundaryRect.left - horizontalInset
      : boundaryRect.right - panelRect.left - horizontalInset,
    0
  );
  const maxHeight = Math.max(
    placement.startsWith("bottom")
      ? panelRect.bottom - boundaryRect.top - verticalInset
      : boundaryRect.bottom - panelRect.top - verticalInset,
    0
  );

  return {
    maxHeight,
    maxWidth,
    minHeight: Math.min(FLOATING_PANEL_MIN_HEIGHT_PX, maxHeight),
    minWidth: Math.min(FLOATING_PANEL_MIN_WIDTH_PX, maxWidth),
  };
}

function getFloatingPanelSizeFromElement({
  element,
  fallback,
}: {
  element: HTMLElement | null;
  fallback: Size;
}): Size {
  const rect = element?.getBoundingClientRect();
  if (rect && rect.width > 0 && rect.height > 0) {
    return {
      width: rect.width,
      height: rect.height,
    };
  }
  return fallback;
}

function getResizedFloatingPanelSize({
  pointer,
  session,
}: {
  pointer: Point;
  session: FloatingPanelResizeSession;
}): Size {
  const nextSize = { ...session.startSize };

  if (session.axis === "horizontal") {
    const delta =
      session.edge === "left"
        ? session.startPointer.x - pointer.x
        : pointer.x - session.startPointer.x;
    nextSize.width = clamp(
      session.startSize.width + delta,
      session.limits.minWidth,
      session.limits.maxWidth
    );
  } else {
    const delta =
      session.edge === "top"
        ? session.startPointer.y - pointer.y
        : pointer.y - session.startPointer.y;
    nextSize.height = clamp(
      session.startSize.height + delta,
      session.limits.minHeight,
      session.limits.maxHeight
    );
  }

  return nextSize;
}

function getKeyboardResizeDelta({
  axis,
  edge,
  key,
}: {
  axis: FloatingPanelResizeAxis;
  edge: FloatingPanelResizeEdge;
  key: string;
}): number | null {
  if (axis === "horizontal") {
    switch (key) {
      case "ArrowLeft":
        return edge === "left"
          ? FLOATING_PANEL_KEYBOARD_RESIZE_STEP_PX
          : -FLOATING_PANEL_KEYBOARD_RESIZE_STEP_PX;
      case "ArrowRight":
        return edge === "right"
          ? FLOATING_PANEL_KEYBOARD_RESIZE_STEP_PX
          : -FLOATING_PANEL_KEYBOARD_RESIZE_STEP_PX;
      default:
        return null;
    }
  }

  switch (key) {
    case "ArrowDown":
      return edge === "bottom"
        ? FLOATING_PANEL_KEYBOARD_RESIZE_STEP_PX
        : -FLOATING_PANEL_KEYBOARD_RESIZE_STEP_PX;
    case "ArrowUp":
      return edge === "top"
        ? FLOATING_PANEL_KEYBOARD_RESIZE_STEP_PX
        : -FLOATING_PANEL_KEYBOARD_RESIZE_STEP_PX;
    default:
      return null;
  }
}

const panelHeaderCSS = css`
  ${fadedDividerBottomCSS}
  z-index: ${PANEL_HEADER_Z_INDEX};
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--global-dimension-size-100) var(--global-dimension-size-150);
  background: var(--global-background-color-default);
`;

const panelHeaderActionsCSS = css`
  flex-shrink: 0;
`;

const sessionHeadingCSS = css`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 1;
`;

const panelContentCSS = css`
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  height: 100%;
  min-width: 420px;
  overflow: hidden;
  border-top: 1px solid var(--global-border-color-default);
`;

/**
 * Shared header for PXI chat surfaces.
 */
export function AgentChatHeader({
  sessionDisplayName,
  orderedSessions,
  activeSessionId,
  showSessionHistory,
  position,
  onSelectSession,
  onDeleteSession,
  onCreateSession,
  onPositionChange,
  onClose,
}: {
  sessionDisplayName: string;
  orderedSessions: AgentSession[];
  activeSessionId: string | null;
  showSessionHistory: boolean;
  position?: AgentPosition;
  onSelectSession: (sessionId: string | null) => void;
  onDeleteSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onPositionChange?: (position: AgentPosition) => void;
  onClose: () => void;
}) {
  const nextPosition = position === "pinned" ? "detached" : "pinned";
  const positionToggleLabel =
    position === "pinned"
      ? "Switch assistant to floating panel"
      : "Pin assistant to side";

  return (
    <div css={panelHeaderCSS}>
      <Flex direction="row" alignItems="center" gap="size-50" minWidth={0}>
        <PxiGlyph
          fill="var(--global-text-color-900)"
          css={css`
            transform: scale(0.7);
          `}
        />
        <Text weight="heavy" css={sessionHeadingCSS} title={sessionDisplayName}>
          {sessionDisplayName}
        </Text>
      </Flex>
      <Flex
        direction="row"
        alignItems="center"
        gap="size-50"
        css={panelHeaderActionsCSS}
      >
        {showSessionHistory ? (
          <SessionListMenu
            sessions={orderedSessions}
            activeSessionId={activeSessionId}
            onSelectSession={onSelectSession}
            onDeleteSession={onDeleteSession}
          />
        ) : null}
        <Button
          variant="quiet"
          size="S"
          aria-label="New chat"
          onPress={onCreateSession}
          leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
        />
        {position != null && onPositionChange != null ? (
          <Button
            variant="quiet"
            size="S"
            aria-label={positionToggleLabel}
            onPress={() => onPositionChange(nextPosition)}
            leadingVisual={
              <Icon
                svg={
                  position === "pinned" ? <Icons.SlideOut /> : <Icons.SlideIn />
                }
              />
            }
          />
        ) : null}
        <LinkButton
          variant="quiet"
          size="S"
          to="/settings/agents"
          aria-label="Agent settings"
          leadingVisual={<Icon svg={<Icons.OptionsOutline />} />}
        />
        <Button
          variant="quiet"
          size="S"
          aria-label="Close agent chat"
          onPress={onClose}
          leadingVisual={<Icon svg={<Icons.CloseOutline />} />}
        />
      </Flex>
    </div>
  );
}

/**
 * Shared content frame for the docked and embedded PXI surfaces.
 */
function AgentChatFrame({
  panelId,
  panelProps,
  children,
  contentCss,
}: {
  panelId: string;
  panelProps?: Partial<React.ComponentProps<typeof Panel>>;
  children: ReactNode;
  contentCss: ReturnType<typeof css>;
}) {
  return (
    <>
      <Separator css={compactResizeHandleCSS} />
      <Panel {...panelProps} id={panelId}>
        <div css={contentCss}>{children}</div>
      </Panel>
    </>
  );
}

/**
 * Presentational shell for the docked resizable agent panel.
 */
export function DockedAgentChatFrame({ children }: { children: ReactNode }) {
  return (
    <AgentChatFrame
      panelId="agent-chat"
      panelProps={{
        minSize: "420px",
        maxSize: "50%",
        defaultSize: "420px",
        groupResizeBehavior: "preserve-pixel-size",
      }}
      contentCss={panelContentCSS}
    >
      {children}
    </AgentChatFrame>
  );
}

const floatingPanelContentCSS = css`
  --floating-agent-chat-panel-width: ${FLOATING_PANEL_WIDTH_PX}px;
  --floating-agent-chat-panel-height: ${FLOATING_PANEL_HEIGHT_PX}px;

  position: absolute;
  z-index: ${NON_MODAL_FLOATING_Z_INDEX};
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: var(--floating-agent-chat-panel-width);
  height: var(--floating-agent-chat-panel-height);
  max-width: calc(100% - ${FLOATING_PANEL_VIEWPORT_MARGIN});
  max-height: calc(100% - ${FLOATING_PANEL_VIEWPORT_MARGIN});
  min-width: min(
    ${FLOATING_PANEL_MIN_WIDTH_PX}px,
    calc(100% - ${FLOATING_PANEL_VIEWPORT_MARGIN})
  );
  min-height: min(
    ${FLOATING_PANEL_MIN_HEIGHT_PX}px,
    calc(100% - ${FLOATING_PANEL_VIEWPORT_MARGIN})
  );
  overflow: hidden;
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  background: var(--global-background-color-default);
  box-shadow:
    0 12px 32px rgba(var(--global-color-gray-900-rgb), 0.2),
    0 2px 8px rgba(var(--global-color-gray-900-rgb), 0.12);

  &[data-resizing="true"] {
    user-select: none;
  }

  &[data-placement^="top"] {
    top: var(--global-dimension-size-200);
  }

  &[data-placement^="bottom"] {
    bottom: var(--global-dimension-size-200);
  }

  &[data-placement$="start"] {
    left: var(--global-dimension-size-200);
  }

  &[data-placement$="end"] {
    right: var(--global-dimension-size-200);
  }

  .floating-agent-chat-panel__resize-handle {
    position: absolute;
    z-index: ${PANEL_HEADER_Z_INDEX + 1};
    border: none;
    outline: none;
    padding: 0;
    background: transparent;
    touch-action: none;
  }

  .floating-agent-chat-panel__resize-handle::after {
    content: "";
    position: absolute;
    background-color: transparent;
    transition: background-color 150ms ease-out;
  }

  .floating-agent-chat-panel__resize-handle:hover::after,
  .floating-agent-chat-panel__resize-handle[data-resizing="true"]::after,
  .floating-agent-chat-panel__resize-handle:focus-visible::after {
    background-color: var(--global-resize-handle-indicator-color-hover);
  }

  .floating-agent-chat-panel__resize-handle:focus-visible {
    outline: 2px solid var(--global-color-primary);
    outline-offset: -2px;
  }

  .floating-agent-chat-panel__resize-handle[data-edge="left"],
  .floating-agent-chat-panel__resize-handle[data-edge="right"] {
    top: 0;
    bottom: 0;
    width: ${FLOATING_PANEL_RESIZE_HANDLE_SIZE_PX}px;
    cursor: ew-resize;
  }

  .floating-agent-chat-panel__resize-handle[data-edge="left"] {
    left: 0;
  }

  .floating-agent-chat-panel__resize-handle[data-edge="right"] {
    right: 0;
  }

  .floating-agent-chat-panel__resize-handle[data-edge="left"]::after,
  .floating-agent-chat-panel__resize-handle[data-edge="right"]::after {
    top: 0;
    bottom: 0;
    width: 2px;
  }

  .floating-agent-chat-panel__resize-handle[data-edge="left"]::after {
    left: 0;
  }

  .floating-agent-chat-panel__resize-handle[data-edge="right"]::after {
    right: 0;
  }

  .floating-agent-chat-panel__resize-handle[data-edge="top"],
  .floating-agent-chat-panel__resize-handle[data-edge="bottom"] {
    right: 0;
    left: 0;
    height: ${FLOATING_PANEL_RESIZE_HANDLE_SIZE_PX}px;
    cursor: ns-resize;
  }

  .floating-agent-chat-panel__resize-handle[data-edge="top"] {
    top: 0;
  }

  .floating-agent-chat-panel__resize-handle[data-edge="bottom"] {
    bottom: 0;
  }

  .floating-agent-chat-panel__resize-handle[data-edge="top"]::after,
  .floating-agent-chat-panel__resize-handle[data-edge="bottom"]::after {
    right: 0;
    left: 0;
    height: 2px;
  }

  .floating-agent-chat-panel__resize-handle[data-edge="top"]::after {
    top: 0;
  }

  .floating-agent-chat-panel__resize-handle[data-edge="bottom"]::after {
    bottom: 0;
  }

  @media (max-width: ${FLOATING_PANEL_FULLSCREEN_BREAKPOINT_PX}px), (max-height: ${FLOATING_PANEL_FULLSCREEN_BREAKPOINT_PX}px) {
    inset: var(--global-dimension-size-100);
    width: auto;
    height: auto;
    max-width: none;
    max-height: none;
    min-height: 0;
    min-width: 0;

    .floating-agent-chat-panel__resize-handle {
      display: none;
    }
  }
`;

/**
 * Presentational shell for the floating PXI panel.
 */
export function FloatingAgentChatFrame({
  children,
  placement,
  size = DEFAULT_FLOATING_AGENT_CHAT_SIZE,
  onSizeChange,
}: {
  children: ReactNode;
  placement: AgentFabPlacement;
  size?: Size;
  onSizeChange?: (size: Size) => void;
}) {
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const resizeSessionRef = useRef<FloatingPanelResizeSession | null>(null);
  const pendingSizeRef = useRef<Size | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const [resizingEdge, setResizingEdge] =
    useState<FloatingPanelResizeEdge | null>(null);

  const resizeLimits = getFloatingPanelResizeLimits(
    panelRef.current,
    placement
  );
  const resizeHandles = getFloatingPanelResizeHandles(placement);
  const commitSize = (
    nextSize: Size,
    limits = getFloatingPanelResizeLimits(panelRef.current, placement)
  ) => {
    onSizeChange?.({
      height: clamp(nextSize.height, limits.minHeight, limits.maxHeight),
      width: clamp(nextSize.width, limits.minWidth, limits.maxWidth),
    });
  };
  const flushPendingSize = () => {
    animationFrameIdRef.current = null;
    if (pendingSizeRef.current == null) return;
    const nextSize = pendingSizeRef.current;
    pendingSizeRef.current = null;
    onSizeChange?.(nextSize);
  };
  const handleResizePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    { axis, edge }: FloatingPanelResizeHandleConfig
  ) => {
    if (event.button !== PRIMARY_POINTER_BUTTON) return;

    const panel = panelRef.current;
    if (!panel) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    resizeSessionRef.current = {
      axis,
      edge,
      limits: getFloatingPanelResizeLimits(panel, placement),
      pointerId: event.pointerId,
      startPointer: { x: event.clientX, y: event.clientY },
      startSize: getFloatingPanelSizeFromElement({
        element: panel,
        fallback: size,
      }),
    };
    setResizingEdge(edge);
    event.preventDefault();
  };
  const handleResizePointerMove = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    const session = resizeSessionRef.current;
    if (!session) return;

    pendingSizeRef.current = getResizedFloatingPanelSize({
      pointer: { x: event.clientX, y: event.clientY },
      session,
    });
    event.preventDefault();

    if (animationFrameIdRef.current == null) {
      animationFrameIdRef.current =
        window.requestAnimationFrame(flushPendingSize);
    }
  };
  const finishResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = resizeSessionRef.current;
    if (!session) return;

    if (animationFrameIdRef.current != null) {
      window.cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    pendingSizeRef.current = null;
    onSizeChange?.(
      getResizedFloatingPanelSize({
        pointer: { x: event.clientX, y: event.clientY },
        session,
      })
    );
    resizeSessionRef.current = null;
    setResizingEdge(null);

    if (event.currentTarget.hasPointerCapture(session.pointerId)) {
      event.currentTarget.releasePointerCapture(session.pointerId);
    }
  };
  const handleResizeKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
    { axis, edge }: FloatingPanelResizeHandleConfig
  ) => {
    const limits = getFloatingPanelResizeLimits(panelRef.current, placement);

    if (event.key === "Home") {
      event.preventDefault();
      commitSize(
        {
          height: axis === "vertical" ? limits.minHeight : size.height,
          width: axis === "horizontal" ? limits.minWidth : size.width,
        },
        limits
      );
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      commitSize(
        {
          height: axis === "vertical" ? limits.maxHeight : size.height,
          width: axis === "horizontal" ? limits.maxWidth : size.width,
        },
        limits
      );
      return;
    }

    const delta = getKeyboardResizeDelta({ axis, edge, key: event.key });
    if (delta == null) return;

    event.preventDefault();
    commitSize(
      {
        height: axis === "vertical" ? size.height + delta : size.height,
        width: axis === "horizontal" ? size.width + delta : size.width,
      },
      limits
    );
  };

  useEffect(() => {
    return () => {
      if (animationFrameIdRef.current != null) {
        window.cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, []);

  return (
    <div
      id={panelId}
      className="floating-agent-chat-panel"
      css={floatingPanelContentCSS}
      data-placement={placement}
      data-resizing={resizingEdge == null ? undefined : "true"}
      ref={panelRef}
      style={
        {
          "--floating-agent-chat-panel-height": `${size.height}px`,
          "--floating-agent-chat-panel-width": `${size.width}px`,
        } as CSSProperties
      }
    >
      {resizeHandles.map((handle) => (
        <div
          key={handle.edge}
          role="separator"
          tabIndex={0}
          aria-controls={panelId}
          aria-label={
            handle.axis === "horizontal"
              ? "Resize assistant width"
              : "Resize assistant height"
          }
          aria-orientation={
            handle.axis === "horizontal" ? "vertical" : "horizontal"
          }
          aria-valuemax={Math.round(
            handle.axis === "horizontal"
              ? resizeLimits.maxWidth
              : resizeLimits.maxHeight
          )}
          aria-valuemin={Math.round(
            handle.axis === "horizontal"
              ? resizeLimits.minWidth
              : resizeLimits.minHeight
          )}
          aria-valuenow={Math.round(
            handle.axis === "horizontal" ? size.width : size.height
          )}
          className="floating-agent-chat-panel__resize-handle"
          data-edge={handle.edge}
          data-resizing={resizingEdge === handle.edge ? "true" : undefined}
          onKeyDown={(event) => handleResizeKeyDown(event, handle)}
          onPointerCancel={finishResize}
          onPointerDown={(event) => handleResizePointerDown(event, handle)}
          onPointerMove={handleResizePointerMove}
          onPointerUp={finishResize}
        />
      ))}
      {children}
    </div>
  );
}

const tracePanelContentCSS = css`
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  height: 100%;
  min-width: 0;
  overflow: hidden;
  border-left: 1px solid var(--global-border-color-default);
  background: var(--global-background-color-primary);
`;

/**
 * Presentational shell for the trace slideover's embedded PXI panel.
 */
export function TraceAgentChatFrame({ children }: { children: ReactNode }) {
  return (
    <AgentChatFrame
      panelId="trace-agent-chat"
      panelProps={{
        defaultSize: "32%",
        minSize: "24%",
        maxSize: "45%",
      }}
      contentCss={tracePanelContentCSS}
    >
      {children}
    </AgentChatFrame>
  );
}
