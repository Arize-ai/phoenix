import type { HTMLAttributes, ReactNode, Ref } from "react";
import type { ButtonProps } from "react-aria-components";

import type { DOMProps } from "../../core/types/dom";

/**
 * Which participant sent the message. Determines layout direction and styling.
 * - `"user"` — right-aligned bubble with background color.
 * - `"assistant"` — left-aligned, full-width, no background.
 */
export type MessageFrom = "user" | "assistant";

// ---------------------------------------------------------------------------
// Context values
// ---------------------------------------------------------------------------

export interface MessageContextValue {
  from: MessageFrom;
}

export interface MessageBranchContextValue {
  activeBranch: number;
  branchCount: number;
  setActiveBranch: (index: number) => void;
  /** @internal Used by MessageBranchContent to register its child count. */
  setBranchCount: (count: number) => void;
}

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------

export interface MessageProps extends HTMLAttributes<HTMLDivElement>, DOMProps {
  ref?: Ref<HTMLDivElement>;
  /** Which participant sent this message. */
  from: MessageFrom;
  children: ReactNode;
}

export interface MessageContentProps
  extends HTMLAttributes<HTMLDivElement>, DOMProps {
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
}

export interface MessageResponseProps extends DOMProps {
  /** Markdown string to render. */
  children: string;
  /**
   * Controls how Streamdown parses the markdown content.
   * - `"static"` — parses the full content at once (default).
   * - `"streaming"` — parses incrementally per-block with memoization.
   * @default "static"
   */
  renderMode?: "static" | "streaming";
}

export interface MessageActionsProps
  extends HTMLAttributes<HTMLDivElement>, DOMProps {
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
}

/**
 * Tooltip configuration for a `MessageAction`.
 *
 * - **String** — rendered as simple tooltip text.
 * - **Object** — allows custom placement.
 *
 * @example
 * ```tsx
 * tooltip="Copy to clipboard"
 * tooltip={{ content: "Regenerate", position: "bottom" }}
 * ```
 */
export type MessageActionTooltip =
  | string
  | {
      /** Tooltip text content. */
      content: string;
      /**
       * Tooltip position relative to the button.
       * @default "top"
       */
      position?: "top" | "bottom" | "left" | "right";
    };

export interface MessageActionProps extends Omit<
  ButtonProps,
  "children" | "className"
> {
  ref?: Ref<HTMLButtonElement>;
  /** Icon content. */
  children: ReactNode;
  /** Accessible label (applied as aria-label). */
  label: string;
  /** Optional tooltip shown on hover. */
  tooltip?: MessageActionTooltip;
  /** Additional CSS class name. */
  className?: string;
}

export interface MessageToolbarProps
  extends HTMLAttributes<HTMLDivElement>, DOMProps {
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
}

export interface MessageBranchProps extends DOMProps {
  children: ReactNode;
  /**
   * The initially active branch index (zero-based).
   * @default 0
   */
  defaultBranch?: number;
}

export interface MessageBranchContentProps {
  /** One child per branch. Only the active branch is rendered. */
  children: ReactNode[];
}

export interface MessageBranchSelectorProps
  extends HTMLAttributes<HTMLDivElement>, DOMProps {
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
}

export interface MessageBranchPreviousProps extends Omit<
  ButtonProps,
  "children"
> {
  ref?: Ref<HTMLButtonElement>;
}

export interface MessageBranchNextProps extends Omit<ButtonProps, "children"> {
  ref?: Ref<HTMLButtonElement>;
}
