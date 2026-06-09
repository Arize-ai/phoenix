import { css } from "@emotion/react";
import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { usePromptInputContext } from "@phoenix/components/ai/prompt-input/PromptInputContext";

import { SkillHighlightOverlay } from "./SkillHighlightOverlay";
import { SkillMenu } from "./SkillMenu";
import type { AvailableAgentSkill } from "./useAvailableAgentSkills";
import { usePromptSkillCommand } from "./usePromptSkillCommand";

const wrapperCSS = css`
  position: relative;
  width: 100%;
`;

// The textarea sits above the highlight overlay with transparent text so the
// overlay's highlighted runs show through, while the caret stays visible.
const textareaCSS = css`
  position: relative;
  display: block;
  width: 100%;
  // border-box so the auto-resize (height = scrollHeight) accounts for the
  // vertical padding below and the box fits its content exactly.
  box-sizing: border-box;
  // 3 lines of text plus the vertical padding, so the empty input keeps its
  // original height.
  min-height: calc(
    var(--global-line-height-s) * 3 + var(--global-dimension-size-100)
  );
  border: none;
  outline: none;
  background: transparent;
  resize: none;
  // MUST stay identical to the overlay's padding (sharedTextBoxCSS in
  // SkillHighlightOverlay); the padding keeps highlighted runs clear of the
  // overlay's clip edges. See the note there.
  padding: var(--global-dimension-size-50);
  margin: 0;
  font-family: inherit;
  font-size: var(--global-font-size-s);
  line-height: var(--global-line-height-s);
  color: transparent;
  caret-color: var(--prompt-input-textarea-color);
  overflow-y: auto;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: break-word;

  &::placeholder {
    color: var(--prompt-input-textarea-placeholder-color);
    font-style: normal;
    -webkit-text-fill-color: var(--prompt-input-textarea-placeholder-color);
  }

  &:disabled {
    opacity: var(--global-opacity-disabled);
    cursor: not-allowed;
  }
`;

const LISTBOX_ID = "agent-skill-menu";
const getOptionId = (index: number) => `${LISTBOX_ID}-option-${index}`;

export type SkillPromptInputProps = {
  placeholder?: string;
  /**
   * Skills available for the current context, used to drive the slash-command
   * menu and the recognized-token highlight. Supplied by the parent so the same
   * catalog can be reused for the submit-time requested-skills parse.
   */
  skills: AvailableAgentSkill[];
  /** Forwarded to the underlying textarea so callers can focus it. */
  textareaRef?: React.Ref<HTMLTextAreaElement>;
  /** Optional layer outside the prompt surface where the menu can be stacked. */
  menuPortalTarget?: HTMLElement | null;
};

/**
 * Prompt textarea augmented with the slash-command skill loader.
 *
 * Renders a transparent-text textarea over a {@link SkillHighlightOverlay} so
 * recognized `/skill-name` tokens are highlighted in place, and shows a
 * {@link SkillMenu} when the user types a `/` trigger. The textarea retains
 * focus and drives the menu via its own key handler; selection inserts the
 * skill token as plain text (never stripped). Reads value/setValue/submit from
 * the surrounding `PromptInput` context.
 */
export function SkillPromptInput({
  placeholder = "Send a message...",
  skills,
  textareaRef: forwardedTextareaRef,
  menuPortalTarget,
}: SkillPromptInputProps) {
  const { value, setValue, onSubmit, isDisabled } = usePromptInputContext();
  const skillCommand = usePromptSkillCommand(skills);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Merge the internal ref (used for auto-resize and caret control) with the
  // optional forwarded ref so callers can also focus the textarea.
  const mergeTextareaRef = (node: HTMLTextAreaElement | null) => {
    textareaRef.current = node;
    if (typeof forwardedTextareaRef === "function") {
      forwardedTextareaRef(node);
    } else if (forwardedTextareaRef && "current" in forwardedTextareaRef) {
      (
        forwardedTextareaRef as React.RefObject<HTMLTextAreaElement | null>
      ).current = node;
    }
  };

  const recognizedSkillNames = new Set(skills.map((skill) => skill.name));

  // Auto-resize the textarea to fit its content, mirroring PromptInputTextarea.
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  const syncOverlayScroll = () => {
    const textarea = textareaRef.current;
    const overlay = overlayRef.current;
    if (textarea && overlay) {
      overlay.scrollTop = textarea.scrollTop;
      overlay.scrollLeft = textarea.scrollLeft;
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    setValue(next);
    skillCommand.syncFromInput(
      next,
      event.target.selectionStart ?? next.length
    );
  };

  const refreshActiveQuery = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    skillCommand.syncFromInput(
      textarea.value,
      textarea.selectionStart ?? textarea.value.length
    );
  };

  const commitSelection = (index: number) => {
    const skill = skillCommand.filteredSkills[index];
    if (!skill) return;
    const result = skillCommand.selectSkill(value, skill);
    if (!result) return;
    setValue(result.value);
    // Restore the caret after React applies the new value.
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(result.caret, result.caret);
        skillCommand.syncFromInput(result.value, result.caret);
      }
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (skillCommand.isOpen) {
      const lastIndex = skillCommand.filteredSkills.length - 1;
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          skillCommand.setActiveIndex(
            skillCommand.activeIndex >= lastIndex
              ? 0
              : skillCommand.activeIndex + 1
          );
          return;
        case "ArrowUp":
          event.preventDefault();
          skillCommand.setActiveIndex(
            skillCommand.activeIndex <= 0
              ? lastIndex
              : skillCommand.activeIndex - 1
          );
          return;
        case "Enter":
        case "Tab":
          event.preventDefault();
          commitSelection(skillCommand.activeIndex);
          return;
        case "Escape":
          event.preventDefault();
          skillCommand.dismiss();
          return;
        default:
          break;
      }
    }
    // Default prompt-input behavior: Enter submits, Shift+Enter inserts newline.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  };

  const menu = skillCommand.isOpen ? (
    <SkillMenu
      skills={skillCommand.filteredSkills}
      activeIndex={skillCommand.activeIndex}
      onSelect={(skill) =>
        commitSelection(skillCommand.filteredSkills.indexOf(skill))
      }
      onActiveIndexChange={skillCommand.setActiveIndex}
      listboxId={LISTBOX_ID}
      getOptionId={getOptionId}
    />
  ) : null;

  return (
    <div css={wrapperCSS}>
      {menuPortalTarget ? createPortal(menu, menuPortalTarget) : menu}
      <SkillHighlightOverlay
        ref={overlayRef}
        value={value}
        recognizedSkillNames={recognizedSkillNames}
      />
      <textarea
        ref={mergeTextareaRef}
        css={textareaCSS}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onKeyUp={refreshActiveQuery}
        onClick={refreshActiveQuery}
        onScroll={syncOverlayScroll}
        placeholder={placeholder}
        disabled={isDisabled}
        aria-label="Message input"
        rows={1}
        role="combobox"
        aria-expanded={skillCommand.isOpen}
        aria-controls={skillCommand.isOpen ? LISTBOX_ID : undefined}
        aria-activedescendant={
          skillCommand.isOpen
            ? getOptionId(skillCommand.activeIndex)
            : undefined
        }
      />
    </div>
  );
}
