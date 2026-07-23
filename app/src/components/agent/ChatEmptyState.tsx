import { css } from "@emotion/react";
import type { CSSProperties, ReactNode } from "react";

import { Icon, Icons } from "@phoenix/components";

import { ChatEmptyShaderHero } from "./ChatEmptyShaderHero";

export type EmptyStateQuickAction = {
  icon: ReactNode;
  label: string;
  prompt: string;
};

/**
 * Fallback quick actions shown when the assistant has no page-specific context to draw
 * suggestions from (e.g. on a route that advertises no agent context). When a
 * page does advertise context, {@link useAgentQuickActions} supplies a tailored
 * set instead.
 */
export const DEFAULT_QUICK_ACTIONS: EmptyStateQuickAction[] = [
  {
    icon: <Icons.Bulb />,
    label: "How do I use Phoenix?",
    prompt: "How do I use Phoenix?",
  },
  {
    icon: <Icons.Book />,
    label: "Explain a concept",
    prompt: "Explain a Phoenix concept to me.",
  },
  {
    icon: <Icons.Trace />,
    label: "Find critical issues",
    prompt: "Find critical issues in my traces.",
  },
];

const emptyStateCSS = css`
  container-type: inline-size;
  width: min(100%, var(--global-dimension-size-8500));
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--global-dimension-size-200);
  color: var(--global-text-color-300);
`;

const actionsCSS = css`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  margin-top: var(--global-dimension-size-100);
`;

const actionCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-150);
  width: 100%;
  padding: var(--global-dimension-size-150) var(--global-dimension-size-200);
  background: transparent;
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  color: var(--global-text-color-500);
  font-size: var(--global-font-size-s);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    background: var(--global-color-gray-100);
    border-color: var(
      --global-border-color-hover,
      var(--global-color-gray-300)
    );
    color: var(--global-text-color-900);
  }

  @media (prefers-reduced-motion: reduce) {
    transform: none;
  }
`;

const actionIconCSS = css`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--global-text-color-500);
  font-size: 16px;
`;

export function ChatEmptyState({
  subtext,
  children,
  quickActions = DEFAULT_QUICK_ACTIONS,
  onQuickAction,
}: React.PropsWithChildren<{
  subtext?: ReactNode;
  quickActions?: EmptyStateQuickAction[];
  onQuickAction: (prompt: string) => void;
}>) {
  return (
    <div css={emptyStateCSS} className="chat__empty">
      <ChatEmptyShaderHero subtext={subtext} />
      {children ?? (
        <ChatEmptyStateQuickActions
          quickActions={quickActions}
          onQuickAction={onQuickAction}
        />
      )}
    </div>
  );
}

export function ChatEmptyStateQuickActions({
  quickActions = DEFAULT_QUICK_ACTIONS,
  onQuickAction,
}: {
  quickActions?: EmptyStateQuickAction[];
  onQuickAction: (prompt: string) => void;
}) {
  if (quickActions.length === 0) {
    return null;
  }
  return (
    <div css={actionsCSS} className="chat__empty-actions">
      {quickActions.map((action, index) => {
        const actionStyle: CSSProperties & Record<`--${string}`, string> = {
          "--chat-empty-action-delay": `${400 + index * 80}ms`,
        };
        return (
          <button
            key={action.label}
            type="button"
            css={actionCSS}
            className="chat__empty-action"
            style={actionStyle}
            onClick={() => onQuickAction(action.prompt)}
          >
            <span css={actionIconCSS} className="chat__empty-action-icon">
              <Icon svg={action.icon} />
            </span>
            <span>{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}
