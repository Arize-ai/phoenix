import type { HTMLAttributes, ReactNode } from "react";
import type { ButtonProps } from "react-aria-components";

import type { DOMProps } from "../../core/types/dom";

/**
 * Status of the prompt input lifecycle
 */
export type PromptInputStatus = "ready" | "submitted" | "streaming" | "error";

/**
 * Shared context value provided by PromptInput root to descendant components
 */
export interface PromptInputContextValue {
  status: PromptInputStatus;
  isDisabled: boolean;
  onSubmit: () => void;
  value: string;
  setValue: (value: string) => void;
}

/**
 * Root container props
 */
export interface PromptInputProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onSubmit">, DOMProps {
  children: ReactNode;
  /**
   * Called when the user submits a message.
   * Receives the current text value.
   */
  onSubmit?: (value: string) => void;
  /**
   * The current lifecycle status of the prompt input.
   * @default "ready"
   */
  status?: PromptInputStatus;
  /**
   * Whether the entire prompt input is disabled.
   * @default false
   */
  isDisabled?: boolean;
}

/**
 * Body area that wraps the textarea
 */
export interface PromptInputBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * Footer toolbar area
 */
export interface PromptInputFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * Left-side tools container in the footer
 */
export interface PromptInputToolsProps extends HTMLAttributes<HTMLDivElement> {}

/**
 * Right-side actions container in the footer
 */
export interface PromptInputActionsProps extends HTMLAttributes<HTMLDivElement> {}

/**
 * Auto-resizing textarea
 */
export interface PromptInputTextareaProps {
  /**
   * Placeholder text shown when empty
   * @default "Send a message..."
   */
  placeholder?: string;
  /**
   * Controlled value. If provided, overrides context value.
   */
  value?: string;
  /**
   * Controlled change handler. If provided, overrides context setValue.
   */
  onChange?: (value: string) => void;
  /**
   * Maximum number of visible rows before scrolling
   */
  maxRows?: number;
  /**
   * Accessible label for the textarea
   */
  "aria-label"?: string;
  className?: string;
}

/**
 * Submit button with status-based icon switching
 */
export interface PromptInputSubmitProps {
  /**
   * Called when pressed during streaming/submitted state (stop handler).
   * During ready/error state, the context onSubmit is called instead.
   */
  onPress?: () => void;
  /**
   * Whether the submit button is disabled
   */
  isDisabled?: boolean;
  /**
   * Accessible label override
   */
  "aria-label"?: string;
  className?: string;
}

/**
 * Tooltip configuration for a prompt input button.
 * Pass a string for simple tooltip, or an object for advanced options.
 */
export type PromptInputButtonTooltip =
  | string
  | {
      content: string;
      shortcut?: string;
      side?: "top" | "bottom" | "left" | "right";
    };

/**
 * Generic tool button for the toolbar area.
 * Styled similar to IconButton with optional built-in tooltip.
 */
export interface PromptInputButtonProps extends Omit<
  ButtonProps,
  "children" | "className"
> {
  children: ReactNode;
  /**
   * Optional tooltip. Pass a string or configuration object.
   */
  tooltip?: PromptInputButtonTooltip;
  className?: string;
}
