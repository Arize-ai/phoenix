import { css } from "@emotion/react";
import { useRef, useState } from "react";
import { Button as AriaButton } from "react-aria-components";

import { Icon, Icons, Text } from "@phoenix/components";
import {
  pierreTemplateVariableColor,
  pierreTokenColors,
} from "@phoenix/components/code";
import { useTheme } from "@phoenix/contexts";

import { parseStateInputNames } from "./decisionUtils";

/**
 * Laid out like the template editor beside it (font, padding, background and
 * height), so switching between Template and Inputs does not move the card.
 */
const surfaceCSS = css`
  background-color: var(--code-mirror-editor-background-color);
  font-family: monospace;
  font-size: var(--global-font-size-s);
  line-height: 1.4;
  min-height: 75px;
  padding: var(--global-dimension-size-100) var(--global-dimension-size-250);
  cursor: text;
  .decision-state-inputs__line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--global-dimension-size-50);
    min-height: 24px;
  }
  .decision-state-inputs__line--entry {
    padding-left: 2ch;
    gap: 0;
  }
  &[data-disabled] {
    cursor: default;
  }
`;

const pillCSS = css`
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-size-25);
  padding: 0 var(--global-dimension-size-75);
  border-radius: var(--global-rounding-small);
  color: var(--decision-state-inputs-variable-color);
  background-color: color-mix(
    in srgb,
    var(--decision-state-inputs-variable-color) 14%,
    transparent
  );
  .decision-state-inputs__remove {
    display: inline-flex;
    align-items: center;
    padding: 0;
    border: none;
    background: none;
    color: inherit;
    cursor: pointer;
    opacity: 0;
    border-radius: var(--global-rounding-small);
    outline: none;
    &[data-focus-visible] {
      opacity: 1;
      outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    }
  }
  &:hover .decision-state-inputs__remove:not([data-disabled]) {
    opacity: 1;
  }
`;

const slotCSS = css`
  font: inherit;
  color: var(--global-text-color-900);
  background: none;
  border: 1px dashed var(--global-border-color-default);
  border-radius: var(--global-rounding-small);
  padding: 0 var(--global-dimension-size-75);
  outline: none;
  &::placeholder {
    color: var(--global-text-color-500);
  }
  &:focus {
    border-style: solid;
    border-color: var(--focus-ring-color);
  }
  &:disabled {
    display: none;
  }
`;

const footerCSS = css`
  display: block;
  padding: var(--global-dimension-size-50) var(--global-dimension-size-250);
  border-top: 1px solid var(--global-border-color-default);
`;

/** The sentence under the inputs saying what the state will be. */
export function describeInputsState(names: readonly string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return `Sends the value of ${names[0]} as-is`;
  return `Sends an object of ${names.length} inputs`;
}

/**
 * The inputs an `inputs` state is made of, drawn as the state it sends: one
 * input is its value, several are an object keyed by name. Each input is a
 * variable pill; names typed into the slot are added on Enter, a comma, or
 * leaving it.
 */
export function DecisionStateInputsEditor({
  names,
  isDisabled,
  isInvalid,
  onChange,
  onBlur,
}: {
  names: readonly string[];
  isDisabled: boolean;
  isInvalid: boolean;
  onChange: (names: string[]) => void;
  onBlur: () => void;
}) {
  const { theme } = useTheme();
  const tokenColors = pierreTokenColors[theme];
  const slotRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState("");

  const addPending = (text: string) => {
    const added = parseStateInputNames(text).filter(
      (name) => !names.includes(name)
    );
    setPending("");
    if (added.length > 0) onChange([...names, ...new Set(added)]);
  };
  const remove = (name: string) => {
    onChange(names.filter((candidate) => candidate !== name));
    // The removed pill held focus; keep the keyboard in the editor.
    slotRef.current?.focus();
  };

  const placeholder = names.length === 0 ? "+ add an input" : "+ input";
  const slot = (
    <input
      ref={slotRef}
      css={slotCSS}
      className="decision-state-inputs__slot"
      aria-label="Add input"
      aria-invalid={isInvalid || undefined}
      placeholder={placeholder}
      size={Math.max(pending.length, placeholder.length) + 1}
      value={pending}
      disabled={isDisabled}
      onChange={(event) => {
        const text = event.target.value;
        if (text.includes(",")) {
          addPending(text);
        } else {
          setPending(text);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          addPending(pending);
        } else if (event.key === "Escape") {
          setPending("");
        } else if (
          event.key === "Backspace" &&
          pending === "" &&
          names.length > 0
        ) {
          event.preventDefault();
          onChange(names.slice(0, -1));
        }
      }}
      onBlur={() => {
        addPending(pending);
        onBlur();
      }}
    />
  );
  const pill = (name: string) => (
    <span css={pillCSS} className="decision-state-inputs__pill">
      {name}
      {isDisabled ? null : (
        <AriaButton
          className="decision-state-inputs__remove"
          aria-label={`Remove ${name}`}
          onPress={() => remove(name)}
        >
          <Icon svg={<Icons.Close />} />
        </AriaButton>
      )}
    </span>
  );
  const punctuation = (text: string) => (
    <span style={{ color: tokenColors.punctuation }}>{text}</span>
  );
  const description = describeInputsState(names);

  return (
    <div>
      <div
        role="group"
        aria-label="State inputs"
        css={surfaceCSS}
        className="decision-state-inputs"
        data-disabled={isDisabled || undefined}
        style={
          {
            "--decision-state-inputs-variable-color":
              pierreTemplateVariableColor[theme],
          } as React.CSSProperties
        }
        onClick={(event) => {
          // A click on empty space lands in the slot, as it would in an editor.
          if (event.target === event.currentTarget) slotRef.current?.focus();
        }}
      >
        {names.length < 2 ? (
          <div className="decision-state-inputs__line">
            {names.length === 1 ? pill(names[0]) : null}
            {slot}
          </div>
        ) : (
          <>
            <div className="decision-state-inputs__line">
              {punctuation("{")}
            </div>
            {names.map((name, index) => (
              <div
                key={name}
                className="decision-state-inputs__line decision-state-inputs__line--entry"
              >
                <span style={{ color: tokenColors.key }}>
                  {JSON.stringify(name)}
                </span>
                {punctuation(": ")}
                {pill(name)}
                {index < names.length - 1 ? punctuation(",") : null}
              </div>
            ))}
            <div className="decision-state-inputs__line decision-state-inputs__line--entry">
              {slot}
            </div>
            <div className="decision-state-inputs__line">
              {punctuation("}")}
            </div>
          </>
        )}
      </div>
      {description ? (
        <Text size="XS" color="text-700" css={footerCSS}>
          {description}
        </Text>
      ) : null}
    </div>
  );
}
