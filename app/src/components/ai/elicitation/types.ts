import type {
  ElicitationQuestion,
  ElicitToolOutput,
} from "@phoenix/agent/tools/elicit";

/**
 * Props for the root {@link ElicitationCarousel} component.
 */
export interface ElicitationCarouselProps {
  /** Ordered list of questions to present. */
  questions: ElicitationQuestion[];
  /** Called when the user submits all answers. */
  onSubmit: (output: ElicitToolOutput) => void;
  /** Called when the user cancels without answering. */
  onCancel?: () => void;
}

/**
 * Props for a single selectable option button.
 */
export interface ElicitationOptionButtonProps {
  /** Whether this option is currently selected. */
  selected: boolean;
  /** Selection mode (`single` = radio, `multi` = checkbox). */
  type: "single" | "multi";
  /** Display label for the option. */
  label: string;
  /** Optional description shown below the label. */
  description?: string;
  /**
   * When true, renders an inline text input instead of a label.
   * Used for the auto-generated "Type your own answer" option.
   */
  isFreeformEntry?: boolean;
  /** Current text value for freeform entry options. */
  textValue?: string;
  /** Called when the option is toggled (clicked or keyboard-activated). */
  onToggle: () => void;
  /** Called when the freeform text input value changes. */
  onTextChange?: (value: string) => void;
}
