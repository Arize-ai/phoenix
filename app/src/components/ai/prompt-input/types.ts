import type { ChatStatus } from "ai";
import type { HTMLAttributes, ReactNode, Ref } from "react";
import type { ButtonProps } from "react-aria-components";

import type { DOMProps } from "../../core/types/dom";

/**
 * The lifecycle status of a prompt input, aligned with `ChatStatus` from the
 * AI SDK (`ai` package) so it can be passed through directly from `useChat`.
 *
 * - `"ready"` — idle, accepting user input. Submit button sends the message.
 * - `"submitted"` — message has been sent, waiting for a response to begin.
 * - `"streaming"` — a response is actively streaming in. Submit button becomes a stop button.
 * - `"error"` — the last request failed. Submit button retries the message.
 */
export type PromptInputStatus = ChatStatus;

/**
 * Internal context value shared between PromptInput and its descendant compound
 * components. Consumers should not need to interact with this directly—use
 * `usePromptInputContext()` only when building custom sub-components.
 */
export interface PromptInputContextValue {
  /** Current lifecycle status of the prompt input. */
  status: PromptInputStatus;
  /** Whether the entire prompt input tree is disabled. */
  isDisabled: boolean;
  /** Trigger a submit. Called by PromptInputTextarea (Enter) and PromptInputSubmit. */
  onSubmit: () => void;
  /** The current text content of the textarea. */
  value: string;
  /** Update the text content. Called by PromptInputTextarea on change. */
  setValue: (value: string) => void;
}

/**
 * Root container for the prompt input compound component.
 *
 * Manages internal text state, provides context to all descendants, and renders
 * the outer container with focus-within styling. Compose with `PromptInputBody`,
 * `PromptInputFooter`, and other sub-components to build a complete input.
 *
 * @example
 * ```tsx
 * <PromptInput onSubmit={(text) => send(text)} status="ready">
 *   <PromptInputBody>
 *     <PromptInputTextarea placeholder="Ask a question..." />
 *   </PromptInputBody>
 *   <PromptInputFooter>
 *     <PromptInputTools>
 *       <PromptInputButton tooltip="Attach" aria-label="Attach">
 *         <Icon svg={<Icons.PlusOutline />} />
 *       </PromptInputButton>
 *     </PromptInputTools>
 *     <PromptInputActions>
 *       <PromptInputSubmit />
 *     </PromptInputActions>
 *   </PromptInputFooter>
 * </PromptInput>
 * ```
 */
/**
 * Controls how the prompt input container responds to focus.
 *
 * - `"prompt"` — the container holds a textarea; `:focus-within` highlights the border.
 * - `"elicitation"` — the container wraps interactive controls (e.g. option buttons);
 *   the container border stays neutral so individual controls can show their own focus.
 */
export type PromptInputMode = "prompt" | "elicitation";

export interface PromptInputProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onSubmit">, DOMProps {
  ref?: Ref<HTMLDivElement>;
  /** Compound component children (Body, Footer, etc.). */
  children: ReactNode;
  /**
   * Called when the user submits a message (Enter key or submit button press).
   * Receives the trimmed text value. The textarea is cleared automatically after submit.
   */
  onSubmit?: (value: string) => void;
  /**
   * The current lifecycle status of the prompt input.
   * Controls submit button icon (send vs. stop) and disabled logic.
   * @default "ready"
   */
  status?: PromptInputStatus;
  /**
   * When true, disables the textarea, submit button, and all tool buttons.
   * @default false
   */
  isDisabled?: boolean;
  /**
   * Controls whether focus-within styling is applied to the container border.
   * @default "prompt"
   */
  mode?: PromptInputMode;
  /**
   * Controlled text value. When provided, makes the prompt input a controlled
   * component — the parent owns the value and must pair this with
   * `onValueChange`. When omitted, the prompt input manages its own state
   * internally.
   */
  value?: string;
  /**
   * Called when the text content changes. Required when `value` is provided.
   */
  onValueChange?: (value: string) => void;
}

/**
 * Scrollable body region that wraps the textarea.
 * Provides padding around the text input area.
 */
export interface PromptInputBodyProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
}

/**
 * Footer toolbar displayed below the textarea.
 * Lays out its children in a row with `PromptInputTools` on the left
 * and `PromptInputActions` on the right.
 */
export interface PromptInputFooterProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
}

/**
 * Left-aligned container in the footer for tool buttons, menus, and other controls.
 * Renders with `role="toolbar"` for accessibility.
 *
 * Can be empty (no children) when no tools are needed—it still reserves layout space
 * so the actions stay right-aligned.
 */
export interface PromptInputToolsProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
}

/**
 * Right-aligned container in the footer for primary actions (e.g. submit button).
 *
 * Can be empty (no children) when no actions are needed.
 */
export interface PromptInputActionsProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
}

/**
 * Auto-resizing textarea that grows with its content.
 *
 * - **Enter** submits the message (calls `context.onSubmit`).
 * - **Shift+Enter** inserts a newline.
 * - Automatically resizes up to `maxRows`, then scrolls.
 * - Reads value/setValue from the parent `PromptInput` context by default.
 *   Pass `value` and `onChange` props to override with controlled state.
 */
export interface PromptInputTextareaProps {
  ref?: Ref<HTMLTextAreaElement>;
  /**
   * Placeholder text shown when the textarea is empty.
   * @default "Send a message..."
   */
  placeholder?: string;
  /**
   * Controlled value. When provided, overrides the value from PromptInput context.
   * Must be paired with `onChange`.
   */
  value?: string;
  /**
   * Controlled change handler. When provided, overrides the setValue from PromptInput context.
   * Receives the raw string value (not an event).
   */
  onChange?: (value: string) => void;
  /**
   * Maximum number of visible text rows before the textarea begins to scroll.
   * When omitted, the textarea grows without limit.
   */
  maxRows?: number;
  /**
   * Accessible label for screen readers.
   * @default "Message input"
   */
  "aria-label"?: string;
  /** Additional CSS class name. */
  className?: string;
}

/**
 * Submit / stop button that adapts its icon and behavior to the current status.
 *
 * | Status                    | Icon              | Press action               |
 * |---------------------------|-------------------|----------------------------|
 * | `"ready"` or `"error"`    | Arrow up (send)   | Calls `context.onSubmit()` |
 * | `"submitted"` / `"streaming"` | Stop circle   | Calls `onPress` prop       |
 *
 * Automatically disables when `status` is `"ready"` and the textarea is empty.
 */
export interface PromptInputSubmitProps {
  ref?: Ref<HTMLButtonElement>;
  /**
   * Called when the button is pressed during `"submitted"` or `"streaming"` status.
   * Use this to cancel or stop the in-flight request.
   * During `"ready"` / `"error"` status the context `onSubmit` is called instead.
   */
  onPress?: () => void;
  /**
   * Explicitly disable the submit button regardless of status or text content.
   */
  isDisabled?: boolean;
  /**
   * Override the default accessible label.
   * Defaults to `"Send message"` when ready or `"Stop generation"` when streaming.
   */
  "aria-label"?: string;
  /** Additional CSS class name. */
  className?: string;
}

/**
 * Tooltip configuration for a `PromptInputButton`.
 *
 * - **String** — rendered as simple tooltip text.
 * - **Object** — allows a keyboard shortcut hint and custom placement.
 *
 * @example
 * ```tsx
 * tooltip="Attach files"
 * tooltip={{ content: "Search the web", shortcut: "⌘K" }}
 * tooltip={{ content: "Voice input", shortcut: "⌘M", position: "bottom" }}
 * ```
 */
export type PromptInputButtonTooltip =
  | string
  | {
      /** Tooltip text content. */
      content: string;
      /** Optional keyboard shortcut displayed alongside the content. */
      shortcut?: string;
      /**
       * Tooltip position relative to the button.
       * @default "top"
       */
      position?: "top" | "bottom" | "left" | "right";
    };

/**
 * Icon button for the toolbar area, styled like `IconButton` (square, transparent
 * background, hover opacity). Optionally wraps itself in a `TooltipTrigger`
 * when the `tooltip` prop is provided.
 *
 * @example
 * ```tsx
 * <PromptInputButton tooltip="Attach files" aria-label="Attach files">
 *   <Icon svg={<Icons.PlusOutline />} />
 * </PromptInputButton>
 *
 * <PromptInputButton tooltip={{ content: "Search", shortcut: "⌘K" }}>
 *   <Icon svg={<Icons.SearchOutline />} />
 * </PromptInputButton>
 * ```
 */
export interface PromptInputButtonProps extends Omit<
  ButtonProps,
  "children" | "className"
> {
  ref?: Ref<HTMLButtonElement>;
  /** Icon (or icon + text) to render inside the button. */
  children: ReactNode;
  /**
   * Optional tooltip shown on hover. Pass a string for simple text or an
   * object for keyboard shortcut hints and custom placement.
   */
  tooltip?: PromptInputButtonTooltip;
  /** Additional CSS class name. */
  className?: string;
}
