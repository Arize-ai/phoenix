import { css, keyframes } from "@emotion/react";
import { Icon, Icons } from "@phoenix/components";
import { useTheme } from "@phoenix/contexts";
import {
  type CSSProperties,
  type ReactNode,
  useSyncExternalStore,
} from "react";

import { PxiShaderGlyph } from "./PxiShaderGlyph";

export type EmptyStateQuickAction = {
  icon: ReactNode;
  label: string;
  /** Prompt text sent to the chat when the action is pressed. */
  prompt: string;
};

const DEFAULT_EMPTY_STATE_SUBTEXT =
  "Ask questions about Phoenix, get help with \n tracing, datasets, evaluations, and more.";

const DEFAULT_EMPTY_STATE_QUICK_ACTIONS: EmptyStateQuickAction[] = [
  {
    icon: <Icons.BulbOutline />,
    label: "How do I use Phoenix?",
    prompt: "How do I use Phoenix?",
  },
  {
    icon: <Icons.BookOutline />,
    label: "Explain a concept",
    prompt: "Explain a Phoenix concept to me.",
  },
  {
    icon: <Icons.Trace />,
    label: "Find critical issues",
    prompt: "Find critical issues in my traces.",
  },
];

type EmptyStateLayoutMode =
  | "compact-narrow"
  | "compact-wide"
  | "bleed-small"
  | "bleed-large"
  | "roomy";

type EmptyStateLayoutVars = {
  glyphSize: number;
  glyphFrameSize: number;
  glyphBleedTop: string;
  heroMinHeight: string;
  heroPaddingTop: string;
};

const DEFAULT_EMPTY_STATE_LAYOUT_MODE: EmptyStateLayoutMode = "bleed-large";

function subscribeToViewportChange(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.addEventListener("resize", onStoreChange);
  return () => {
    window.removeEventListener("resize", onStoreChange);
  };
}

function getEmptyStateLayoutMode(): EmptyStateLayoutMode {
  if (typeof window === "undefined") {
    return DEFAULT_EMPTY_STATE_LAYOUT_MODE;
  }

  if (window.innerHeight <= 720) {
    return window.innerWidth >= 720 ? "compact-wide" : "compact-narrow";
  }

  if (window.innerHeight <= 840) {
    return "bleed-small";
  }

  if (window.innerHeight <= 960) {
    return "bleed-large";
  }

  return "roomy";
}

function getEmptyStateLayoutVars(
  layoutMode: EmptyStateLayoutMode
): EmptyStateLayoutVars {
  switch (layoutMode) {
    case "compact-narrow":
      return {
        glyphSize: 220,
        glyphFrameSize: 88,
        glyphBleedTop: "0px",
        heroMinHeight: "auto",
        heroPaddingTop: "0px",
      };
    case "compact-wide":
      return {
        glyphSize: 220,
        glyphFrameSize: 104,
        glyphBleedTop: "0px",
        heroMinHeight: "auto",
        heroPaddingTop: "0px",
      };
    case "bleed-small":
      return {
        glyphSize: 300,
        glyphFrameSize: 300,
        glyphBleedTop: "calc(-1 * var(--global-dimension-size-750))",
        heroMinHeight: "123px",
        heroPaddingTop: "var(--global-dimension-size-2500)",
      };
    case "bleed-large":
      return {
        glyphSize: 380,
        glyphFrameSize: 380,
        glyphBleedTop: "calc(-1 * var(--global-dimension-size-700))",
        heroMinHeight: "123px",
        heroPaddingTop: "var(--global-dimension-size-3600)",
      };
    case "roomy":
      return {
        glyphSize: 380,
        glyphFrameSize: 380,
        glyphBleedTop: "0px",
        heroMinHeight: "auto",
        heroPaddingTop: "0px",
      };
  }
}

const chatEmptyItemFadeUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(16px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const chatEmptyStateCSS = css`
  container-type: inline-size;
  width: min(100%, var(--global-dimension-size-8500));
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--global-dimension-size-200);
  padding: 0;
  color: var(--global-text-color-300);

  @container (max-width: 479px) {
    .chat__empty-hero {
      width: auto;
    }
  }

  &.chat__empty--row-layout {
    @container (max-width: 479px) {
      .chat__empty-glyph {
        display: none;
      }
    }
  }

  .chat__empty-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    box-sizing: border-box;
    gap: var(--global-dimension-size-150);
    min-height: var(--chat-empty-hero-min-height, auto);
    padding-top: var(--chat-empty-hero-padding-top, 0px);
    width: min(100%, 640px);
  }

  .chat__empty-copy {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--chat-empty-copy-gap, var(--global-dimension-size-100));
  }

  .chat__empty-glyph {
    width: var(--chat-empty-glyph-frame-size, var(--chat-empty-glyph-size, 320px));
    height: var(--chat-empty-glyph-frame-size, var(--chat-empty-glyph-size, 320px));
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: visible;
  }

  &.chat__empty--bleed {
    .chat__empty-glyph {
      position: absolute;
      top: var(--chat-empty-glyph-bleed-top, 0px);
      left: 50%;
      transform: translateX(-50%);
      pointer-events: none;
      z-index: 1;
    }

    .chat__empty-copy,
    .chat__empty-actions {
      position: relative;
      z-index: 2;
    }
  }

  .chat__empty-title {
    margin: 0;
    font-size: var(--global-font-size-l);
    font-weight: var(--px-font-weight-heavy, 600);
    color: var(--global-text-color-900);
    text-align: center;
    opacity: 0;
    animation: ${chatEmptyItemFadeUp} 500ms ease-out 400ms forwards;
  }

  .chat__empty-subtext {
    margin: 0;
    text-align: center;
    color: var(--global-text-color-500);
    line-height: var(--global-line-height-m);
    white-space: pre-line;
    opacity: 0;
    animation: ${chatEmptyItemFadeUp} 500ms ease-out 300ms forwards;
  }

  .chat__empty-actions {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--chat-empty-actions-gap, var(--global-dimension-size-100));
    margin-top: var(
      --chat-empty-actions-margin-top,
      var(--global-dimension-size-100)
    );
  }

  .chat__empty-action {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-150);
    width: 100%;
    padding: var(--chat-empty-action-padding-block, var(--global-dimension-size-150))
      var(--chat-empty-action-padding-inline, var(--global-dimension-size-200));
    background: transparent;
    border: 1px solid var(--global-border-color-default);
    border-radius: var(--global-rounding-medium);
    color: var(--global-text-color-500);
    font-size: var(--global-font-size-s);
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    opacity: 0;
    animation: ${chatEmptyItemFadeUp} 500ms ease-out var(--chat-empty-action-delay, 700ms)
      forwards;
    transition:
      background-color 0.15s ease,
      color 0.15s ease,
      border-color 0.15s ease;
  }

  .chat__empty-action:hover {
    background: var(--global-color-gray-100);
    border-color: var(--global-border-color-hover, var(--global-color-gray-300));
    color: var(--global-text-color-900);
  }

  .chat__empty-action-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--global-text-color-500);
    font-size: 16px;
  }

  @media (prefers-reduced-motion: reduce) {
    .chat__empty-title,
    .chat__empty-subtext,
    .chat__empty-action {
      opacity: 1;
      animation: none;
      transform: none;
    }
  }

  @media (max-height: 720px) and (min-width: 720px) {
    .chat__empty-hero {
      width: 450px;
      flex-direction: row;
      align-items: center;
      justify-content: space-evenly;
      gap: var(--global-dimension-size-200);
    }

    .chat__empty-copy {
      max-width: 320px;
    }
  }

  @media (max-height: 570px) {
    .chat__empty-hero {
      display: none;
    }
  }
`;

export function ChatEmptyState({
  subtext = DEFAULT_EMPTY_STATE_SUBTEXT,
  quickActions = DEFAULT_EMPTY_STATE_QUICK_ACTIONS,
  onQuickAction,
}: {
  subtext?: ReactNode;
  quickActions?: EmptyStateQuickAction[];
  onQuickAction: (prompt: string) => void;
}) {
  const { theme } = useTheme();
  const emptyStateLayoutMode = useSyncExternalStore(
    subscribeToViewportChange,
    getEmptyStateLayoutMode,
    () => DEFAULT_EMPTY_STATE_LAYOUT_MODE
  );
  const layoutVars = getEmptyStateLayoutVars(emptyStateLayoutMode);
  const showsBleedingGlyph = ["bleed-small", "bleed-large"].includes(
    emptyStateLayoutMode
  );
  const usesRowLayout = emptyStateLayoutMode === "compact-wide";

  return (
    <div
      key={theme}
      css={chatEmptyStateCSS}
      className={[
        "chat__empty",
        usesRowLayout ? "chat__empty--row-layout" : null,
        showsBleedingGlyph ? "chat__empty--bleed" : null,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        "--chat-empty-glyph-size": `${layoutVars.glyphSize}px`,
        "--chat-empty-glyph-frame-size": `${layoutVars.glyphFrameSize}px`,
        "--chat-empty-glyph-bleed-top": layoutVars.glyphBleedTop,
        "--chat-empty-hero-min-height": layoutVars.heroMinHeight,
        "--chat-empty-hero-padding-top": layoutVars.heroPaddingTop,
      } as CSSProperties}
    >
      <div className="chat__empty-hero">
        <div className="chat__empty-glyph">
          <PxiShaderGlyph size={layoutVars.glyphSize} />
        </div>
        <div className="chat__empty-copy">
          <h2 className="chat__empty-title">Meet PXI, your Phoenix assistant</h2>
          <p className="chat__empty-subtext">{subtext}</p>
        </div>
      </div>
      {quickActions.length > 0 && (
        <div className="chat__empty-actions">
          {quickActions.map((action, index) => (
            <button
              key={action.label}
              type="button"
              className="chat__empty-action"
              style={
                {
                  "--chat-empty-action-delay": `${400 + index * 80}ms`,
                } as CSSProperties
              }
              onClick={() => onQuickAction(action.prompt)}
            >
              <span className="chat__empty-action-icon">
                <Icon svg={action.icon} />
              </span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
