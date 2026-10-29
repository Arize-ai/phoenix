import { css } from "@emotion/react";
import { useEffect, useRef, useState } from "react";
import {
  Button as AriaButton,
  ComboBox as AriaComboBox,
  Input as AriaInput,
} from "react-aria-components";

import {
  ComboBoxItem,
  Icon,
  Icons,
  KeyboardToken,
  ListBox,
  Popover,
} from "@phoenix/components";
import {
  pierreTemplateVariableColor,
  pierreTokenColors,
} from "@phoenix/components/code";
import { useTheme } from "@phoenix/contexts";
import type { DecisionStateDraft } from "@phoenix/store/playground/types";
import { classNames } from "@phoenix/utils/classNames";

import type { DecisionInputPreview } from "./decisionStateInputsHints";
import {
  getDecisionInputsStateShape,
  parseStateInputNames,
} from "./decisionUtils";

/**
 * The template editor's line-number gutter. The inputs have no line numbers
 * (they are not free text) but start where the template's text starts.
 */
const TEMPLATE_GUTTER_WIDTH = "20px";

/**
 * Laid out like the template editor beside it (font, padding and
 * background), and as tall as its lines: one input is one line.
 */
const surfaceCSS = css`
  background-color: var(--code-mirror-editor-background-color);
  font-family: monospace;
  font-size: var(--global-font-size-s);
  line-height: 1.4;
  padding: var(--global-dimension-size-100) var(--global-dimension-size-250);
  padding-left: calc(
    ${TEMPLATE_GUTTER_WIDTH} + var(--global-dimension-size-250)
  );
  cursor: text;
  .decision-state-inputs__line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--global-dimension-size-50);
    min-height: 22px;
    /* Keep the space in ": " between a key and its pill. */
    white-space: pre;
  }
  .decision-state-inputs__line--entry {
    padding-left: 2ch;
    gap: 0;
  }
  /* A line with a value preview keeps to one line; the preview is cut. */
  .decision-state-inputs__line--previewed {
    flex-wrap: nowrap;
    min-width: 0;
  }
  /* A comma sits in the middle of its monospace cell; pull it up to the
     pill before it, as it would sit after a word. */
  .decision-state-inputs__comma {
    margin-left: -0.3ch;
  }
  .decision-state-inputs__comment {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-left: 2ch;
    color: var(--decision-state-inputs-comment-color);
  }
  /* Always laid out, so showing it moves nothing: it keeps its width when
     hidden, and has no height of its own, so the key (taller than a line)
     overflows evenly instead of growing the line. */
  .decision-state-inputs__enter-hint {
    display: inline-flex;
    align-items: center;
    height: 0;
    margin-left: var(--global-dimension-size-100);
    font-family: var(--global-font-family-sans);
    visibility: hidden;
    &[data-visible] {
      visibility: visible;
    }
  }
  .decision-state-inputs__comment-source {
    opacity: 0.7;
  }
  .decision-state-inputs__link {
    font: inherit;
    font-family: var(--global-font-family-sans);
    font-size: var(--global-font-size-xs);
    color: var(--global-text-color-700);
    background: none;
    border: none;
    padding: 0;
    margin-left: var(--global-dimension-size-100);
    cursor: pointer;
    border-radius: var(--global-rounding-small);
    outline: none;
    &[data-hovered] {
      color: var(--global-text-color-900);
      text-decoration: underline;
    }
    &[data-focus-visible] {
      outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    }
  }
  &[data-disabled] {
    cursor: default;
  }
`;

const pillCSS = css`
  display: inline-flex;
  align-items: center;
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
    box-sizing: border-box;
    padding: 0;
    border: none;
    background: none;
    color: inherit;
    cursor: pointer;
    border-radius: var(--global-rounding-small);
    outline: none;
    /* Takes no room until the pill is hovered or focused, so a pill at rest
       is padded evenly around its name. */
    max-width: 0;
    overflow: hidden;
    &[data-focus-visible] {
      max-width: none;
      padding-left: var(--global-dimension-size-25);
      outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    }
  }
  &:hover .decision-state-inputs__remove {
    max-width: none;
    padding-left: var(--global-dimension-size-25);
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

/**
 * The suggestion list opens wider than the slot it hangs from, and lists
 * names in the slot's monospace font.
 */
const suggestionsPopoverCSS = css`
  min-width: 200px;
  [role="listbox"] {
    max-height: 240px;
  }
  [role="option"] {
    font-family: monospace;
  }
`;

type InputsShape = DecisionStateDraft["inputsShape"];

/**
 * The inputs an `inputs` state is made of, drawn as the state it sends: an
 * object keyed by name, or one input's value alone. Each input is a
 * variable pill, followed by a preview of its value as a code comment; names
 * typed into the slot are added on Enter, a comma, or leaving it. Over a
 * dataset the slot suggests the names its examples have.
 */
export function DecisionStateInputsEditor({
  names,
  inputsShape,
  isDisabled,
  isInvalid,
  onChange,
  onWrap,
  onBlur,
  previews,
  suggestions = [],
}: {
  names: readonly string[];
  inputsShape: InputsShape;
  isDisabled: boolean;
  isInvalid: boolean;
  onChange: (names: string[]) => void;
  /** Wraps a loaded input sent alone in an object; there is no way back. */
  onWrap: () => void;
  onBlur: () => void;
  /** A value to show beside each input, keyed by input name. */
  previews?: Readonly<Record<string, DecisionInputPreview>>;
  /** Names the slot offers, e.g. a dataset's input keys; added ones are skipped. */
  suggestions?: readonly string[];
}) {
  const { theme } = useTheme();
  const tokenColors = pierreTokenColors[theme];
  const slotRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState("");
  // Going between an input sent alone and an object redraws the layout and
  // remounts the slot, so an edit made from the keyboard puts focus back in it.
  const refocusSlot = useRef(false);
  useEffect(() => {
    if (!refocusSlot.current) return;
    refocusSlot.current = false;
    slotRef.current?.focus();
  }, [names, inputsShape]);

  const change = (next: string[], { refocus }: { refocus: boolean }) => {
    refocusSlot.current = refocus;
    onChange(next);
  };
  const addPending = (text: string, { refocus }: { refocus: boolean }) => {
    const added = parseStateInputNames(text).filter(
      (name) => !names.includes(name)
    );
    setPending("");
    if (added.length > 0) change([...names, ...new Set(added)], { refocus });
  };
  // The removed pill held focus; keep the keyboard in the editor.
  const remove = (name: string) =>
    change(
      names.filter((candidate) => candidate !== name),
      { refocus: true }
    );

  const remaining = suggestions.filter((name) => !names.includes(name));
  const query = pending.trim().toLowerCase();
  const matching = remaining.filter((name) =>
    name.toLowerCase().includes(query)
  );
  const placeholder = names.length === 0 ? "+ add an input" : "+ input";
  const slotProps = {
    ref: slotRef,
    css: slotCSS,
    className: "decision-state-inputs__slot",
    "aria-label": "Add input",
    "aria-invalid": isInvalid || undefined,
    placeholder,
    size: Math.max(pending.length, placeholder.length) + 1,
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        // An option highlighted in the suggestion list is the combobox's to
        // pick; otherwise Enter adds what is typed.
        if (event.currentTarget.getAttribute("aria-activedescendant")) return;
        event.preventDefault();
        addPending(pending, { refocus: true });
      } else if (event.key === "Escape") {
        setPending("");
      } else if (
        event.key === "Backspace" &&
        pending === "" &&
        names.length > 0
      ) {
        event.preventDefault();
        change(names.slice(0, -1), { refocus: true });
      }
    },
    onBlur: () => {
      addPending(pending, { refocus: false });
      onBlur();
    },
  };
  const onTextChange = (text: string) => {
    if (text.includes(",")) {
      addPending(text, { refocus: true });
    } else {
      setPending(text);
    }
  };
  const slot =
    remaining.length > 0 && !isDisabled ? (
      <AriaComboBox
        aria-label="Add input"
        allowsCustomValue
        menuTrigger="focus"
        inputValue={pending}
        onInputChange={onTextChange}
        selectedKey={null}
        onSelectionChange={(key) => {
          if (key == null) return;
          addPending(String(key), { refocus: true });
        }}
        items={matching.map((name) => ({ id: name, name }))}
      >
        <AriaInput {...slotProps} />
        <Popover css={suggestionsPopoverCSS} placement="bottom start">
          <ListBox>
            {(item: { id: string; name: string }) => (
              <ComboBoxItem id={item.id} textValue={item.name}>
                {item.name}
              </ComboBoxItem>
            )}
          </ListBox>
        </Popover>
      </AriaComboBox>
    ) : (
      <input
        {...slotProps}
        value={pending}
        disabled={isDisabled}
        onChange={(event) => onTextChange(event.target.value)}
      />
    );
  // Typed names are only added on Enter (or a comma, or leaving the slot).
  const enterHint = isDisabled ? null : (
    <span
      className="decision-state-inputs__enter-hint"
      data-visible={pending.trim() !== "" || undefined}
      aria-hidden
    >
      <KeyboardToken>↵</KeyboardToken>
    </span>
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
  const comment = (name: string) => {
    const preview = previews?.[name];
    if (!preview) return null;
    const source = preview.source;
    return (
      <span
        className="decision-state-inputs__comment"
        title={preview.kind === "value" ? preview.full : undefined}
        aria-label={
          preview.kind === "value"
            ? `${name}${source ? ` in ${source}` : ""}: ${preview.text}`
            : `${name} is not in ${source}`
        }
      >
        {"// "}
        {preview.kind === "missing" ? (
          <span className="decision-state-inputs__comment-source">
            not in {source}
          </span>
        ) : (
          <>
            {source ? (
              <span className="decision-state-inputs__comment-source">
                {source}:{" "}
              </span>
            ) : null}
            {preview.text}
          </>
        )}
      </span>
    );
  };
  const lineClassName = (name: string, entry: boolean) =>
    classNames(
      "decision-state-inputs__line",
      entry && "decision-state-inputs__line--entry",
      previews?.[name] && "decision-state-inputs__line--previewed"
    );
  const punctuation = (text: string) => (
    <span style={{ color: tokenColors.punctuation }}>{text}</span>
  );
  const isObject =
    names.length > 0 &&
    getDecisionInputsStateShape({ inputNames: [...names], inputsShape })
      .shape === "object";
  const canAddAll = names.length === 0 && remaining.length > 0 && !isDisabled;
  // Adds the dataset's names after anything typed but not yet added. Taking
  // focus from the slot would add the typed name first and, with an input
  // listed, drop this button before the press lands, so it never takes it.
  const addAll = () => {
    const typed = parseStateInputNames(pending).filter(
      (name) => !names.includes(name)
    );
    setPending("");
    change([...new Set([...names, ...typed, ...remaining])], {
      refocus: true,
    });
  };

  return (
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
          "--decision-state-inputs-comment-color": tokenColors.comment,
        } as React.CSSProperties
      }
      onClick={(event) => {
        // A click on empty space lands in the slot, as it would in an editor.
        if (event.target === event.currentTarget) slotRef.current?.focus();
      }}
    >
      {isObject ? (
        <>
          <div className="decision-state-inputs__line">{punctuation("{")}</div>
          {names.map((name, index) => (
            <div key={name} className={lineClassName(name, true)}>
              <span style={{ color: tokenColors.key }}>
                {JSON.stringify(name)}
              </span>
              {punctuation(": ")}
              {pill(name)}
              {index < names.length - 1 ? (
                <span
                  className="decision-state-inputs__comma"
                  style={{ color: tokenColors.punctuation }}
                >
                  ,
                </span>
              ) : null}
              {comment(name)}
            </div>
          ))}
          <div className="decision-state-inputs__line decision-state-inputs__line--entry">
            {slot}
            {enterHint}
          </div>
          <div className="decision-state-inputs__line">{punctuation("}")}</div>
        </>
      ) : (
        <div
          className={
            names.length === 1
              ? lineClassName(names[0], false)
              : "decision-state-inputs__line"
          }
        >
          {names.length === 1 ? pill(names[0]) : null}
          {names.length === 1 ? comment(names[0]) : null}
          {slot}
          {enterHint}
          {names.length === 1 && !isDisabled ? (
            <AriaButton
              className="decision-state-inputs__link decision-state-inputs__wrap"
              onPress={() => {
                refocusSlot.current = true;
                onWrap();
              }}
            >
              Wrap in an object
            </AriaButton>
          ) : null}
          {canAddAll ? (
            <AriaButton
              className="decision-state-inputs__link decision-state-inputs__add-all"
              preventFocusOnPress
              onPress={addAll}
            >
              {`Add all ${remaining.length} input${remaining.length === 1 ? "" : "s"} from the dataset`}
            </AriaButton>
          ) : null}
        </div>
      )}
    </div>
  );
}
