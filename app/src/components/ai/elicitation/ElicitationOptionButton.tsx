import { motion } from "motion/react";
import { useEffect, useRef } from "react";

import { elicitationOptionButtonCSS } from "./styles";
import type { ElicitationOptionButtonProps } from "./types";

/**
 * A selectable option button with radio/checkbox indicator and optional
 * inline text entry. Used within the {@link ElicitationCarousel} for
 * `single` and `multi` type questions.
 */
export function ElicitationOptionButton({
  selected,
  type,
  label,
  description,
  isFreeformEntry,
  textValue,
  onToggle,
  onTextChange,
}: ElicitationOptionButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selected && isFreeformEntry && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selected, isFreeformEntry]);

  const indicatorClass =
    type === "single"
      ? "option-button__indicator option-button__indicator--radio"
      : "option-button__indicator option-button__indicator--checkbox";

  return (
    <motion.div
      css={elicitationOptionButtonCSS}
      data-selected={selected}
      onClick={onToggle}
      whileTap={{ scale: 0.98, transition: { type: "tween", duration: 0.06 } }}
      role={type === "single" ? "radio" : "checkbox"}
      aria-checked={selected}
      tabIndex={0}
      onKeyDown={(e) => {
        // Only intercept Enter/Space when the event target is this div itself.
        // If focus is on a child input/textarea, let the keypress through
        // so the user can type freely (e.g. space in freeform text entry).
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
          return;
        }
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <span className={indicatorClass}>
        {type === "multi" && (
          <svg viewBox="0 0 18 18" aria-hidden="true">
            <polyline points="1 9 7 14 15 4" />
          </svg>
        )}
      </span>
      {isFreeformEntry ? (
        <div
          className="option-button__text-entry"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            ref={inputRef}
            type="text"
            className="option-button__text-input"
            value={textValue || ""}
            placeholder="Type your own answer…"
            onMouseDown={() => {
              if (!selected) onToggle();
            }}
            onChange={(e) => {
              if (!selected) onToggle();
              onTextChange?.(e.target.value);
            }}
            aria-label="Type your own answer"
          />
        </div>
      ) : (
        <div className="option-button__content">
          <span className="option-button__label">{label}</span>
          {description ? (
            <span className="option-button__description">{description}</span>
          ) : null}
        </div>
      )}
    </motion.div>
  );
}
