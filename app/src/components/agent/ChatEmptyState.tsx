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

type EmptyStateStageConfig = {
  maxHeight?: number;
  showsHero: boolean;
  usesCompactLayout: boolean;
  usesLayeredHero: boolean;
  glyphSize: number;
  glyphTopOffset: string;
  heroPaddingTop: string;
};

const EMPTY_STATE_STAGE_CONFIG = {
  "actions-only": {
    maxHeight: 570,
    showsHero: false,
    usesCompactLayout: false,
    usesLayeredHero: false,
    glyphSize: 220,
    glyphTopOffset: "0px",
    heroPaddingTop: "0px",
  },
  compact: {
    maxHeight: 720,
    showsHero: true,
    usesCompactLayout: true,
    usesLayeredHero: false,
    glyphSize: 220,
    glyphTopOffset: "0px",
    heroPaddingTop: "0px",
  },
  "stack-small": {
    maxHeight: 840,
    showsHero: true,
    usesCompactLayout: false,
    usesLayeredHero: true,
    glyphSize: 300,
    glyphTopOffset: "calc(-1 * var(--global-dimension-size-700))",
    heroPaddingTop: "var(--global-dimension-size-2500)",
  },
  "stack-large": {
    maxHeight: 960,
    showsHero: true,
    usesCompactLayout: false,
    usesLayeredHero: true,
    glyphSize: 380,
    glyphTopOffset: "calc(-1 * var(--global-dimension-size-700))",
    heroPaddingTop: "var(--global-dimension-size-3600)",
  },
  "stack-roomy": {
    maxHeight: undefined,
    showsHero: true,
    usesCompactLayout: false,
    usesLayeredHero: true,
    glyphSize: 420,
    glyphTopOffset: "calc(-1 * var(--global-dimension-size-700))",
    heroPaddingTop: "var(--global-dimension-size-4000)",
  },
} satisfies Record<string, EmptyStateStageConfig>;

type EmptyStateHeightStage = keyof typeof EMPTY_STATE_STAGE_CONFIG;

const EMPTY_STATE_HEIGHT_STAGE_ORDER: EmptyStateHeightStage[] = [
  "actions-only",
  "compact",
  "stack-small",
  "stack-large",
  "stack-roomy",
];

const DEFAULT_EMPTY_STATE_HEIGHT_STAGE: EmptyStateHeightStage = "stack-large";

function subscribeToViewportChange(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.addEventListener("resize", onStoreChange);
  return () => {
    window.removeEventListener("resize", onStoreChange);
  };
}

function getEmptyStateHeightStage(): EmptyStateHeightStage {
  if (typeof window === "undefined") {
    return DEFAULT_EMPTY_STATE_HEIGHT_STAGE;
  }

  for (const stage of EMPTY_STATE_HEIGHT_STAGE_ORDER) {
    const { maxHeight } = EMPTY_STATE_STAGE_CONFIG[stage];
    if (maxHeight !== undefined && window.innerHeight <= maxHeight) {
      return stage;
    }
  }

  return "stack-roomy";
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
  color: var(--global-text-color-300);

  @container (max-width: 479px) {
    .chat__empty-hero {
      width: auto;
    }
  }

  &.chat__empty--compact {  
    .chat__empty-hero {
      width: 450px;
      flex-direction: row;
      justify-content: space-evenly;
      gap: var(--global-dimension-size-200);
    }

    .chat__empty-glyph {
      --chat-empty-glyph-slot-size: 104px;
    }

    @container (max-width: 479px) {
      .chat__empty-glyph {
        display: none;
      }
    }
    
  }

  &.chat__empty--layered {
    .chat__empty-glyph {
      position: absolute;
      top: var(--chat-empty-glyph-top-offset, 0px);
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
`;

const chatEmptyHeroCSS = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  box-sizing: border-box;
  gap: var(--global-dimension-size-150);
  padding-top: var(--chat-empty-hero-padding-top);
  width: min(100%, 640px);

  .chat__empty-copy {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-100);
    max-width: var(--global-dimensions-size-4000);
  }

  .chat__empty-glyph {
    width: var(--chat-empty-glyph-slot-size, var(--chat-empty-glyph-size));
    height: var(--chat-empty-glyph-slot-size, var(--chat-empty-glyph-size));
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: visible;
  }

  .chat__empty-title {
    margin: 0;
    font-size: var(--global-font-size-l);
    font-weight: var(--px-font-weight-heavy);
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

  @media (prefers-reduced-motion: reduce) {
    .chat__empty-title,
    .chat__empty-subtext {
      opacity: 1;
      animation: none;
      transform: none;
    }
  }
`;

const chatEmptyActionsCSS = css`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  margin-top: var(--global-dimension-size-100);

  .chat__empty-action {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-150);
    width: 100%;
    padding: var(--global-dimension-size-150)
      var(--global-dimension-size-200);
    background: transparent;
    border: 1px solid var(--global-border-color-default);
    border-radius: var(--global-rounding-medium);
    color: var(--global-text-color-500);
    font-size: var(--global-font-size-s);
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    opacity: 0;
    animation: ${chatEmptyItemFadeUp} 500ms ease-out var(--chat-empty-action-delay)
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
    .chat__empty-action {
      opacity: 1;
      animation: none;
      transform: none;
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
  const heightStage = useSyncExternalStore(
    subscribeToViewportChange,
    getEmptyStateHeightStage,
    () => DEFAULT_EMPTY_STATE_HEIGHT_STAGE
  );
  const stageConfig = EMPTY_STATE_STAGE_CONFIG[heightStage];

  return (
    <div
      key={theme}
      css={chatEmptyStateCSS}
      className={[
        "chat__empty",
        stageConfig.usesCompactLayout ? "chat__empty--compact" : null,
        stageConfig.usesLayeredHero ? "chat__empty--layered" : null,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        "--chat-empty-glyph-size": `${stageConfig.glyphSize}px`,
        "--chat-empty-glyph-top-offset": stageConfig.glyphTopOffset,
        "--chat-empty-hero-padding-top": stageConfig.heroPaddingTop,
      } as CSSProperties}
    >
      {stageConfig.showsHero ? (
        <div css={chatEmptyHeroCSS} className="chat__empty-hero">
          <div className="chat__empty-glyph">
            <PxiShaderGlyph size={stageConfig.glyphSize} />
          </div>
          <div className="chat__empty-copy">
            <h2 className="chat__empty-title">Meet PXI, your Phoenix assistant</h2>
            <p className="chat__empty-subtext">{subtext}</p>
          </div>
        </div>
      ) : null}
      {quickActions.length > 0 && (
        <div css={chatEmptyActionsCSS} className="chat__empty-actions">
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
