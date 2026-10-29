import { css } from "@emotion/react";
import type { EditorView, ViewUpdate } from "@uiw/react-codemirror";
import { useEffect, useRef, useState } from "react";

import {
  Button,
  FieldError,
  Flex,
  Icon,
  Icons,
  Input,
  KeyboardToken,
  Text,
  TextField,
} from "@phoenix/components";
import { DecisionJsonTemplateEditor } from "@phoenix/components/decision/DecisionJsonTemplateEditor";
import { findJsonValueSelection } from "@phoenix/components/decision/decisionJsonTemplateExtensions";
import { getWholeTagPath } from "@phoenix/components/decision/decisionTemplateRendering";
import {
  TemplateEditor,
  TemplateEditorWrap,
} from "@phoenix/components/templateEditor";
import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import type { DecisionStateDraft } from "@phoenix/store/playground/types";

import {
  getDefaultVariableName,
  getExampleVariableNames,
  isValidVariableName,
  templateVariable,
  toDecisionVariableText,
  toJsonTemplateOfVariables,
} from "./decisionUtils";

/** A selection that can become a variable, and where the popover sits. */
type MakeVariableTarget = {
  from: number;
  to: number;
  /** What replaces the selection, given the variable's name. */
  toReplacement: (name: string) => string;
  /** The variable's value: the selection, as the Variables pane holds it. */
  value: { text: string; isReadAsText: boolean };
  defaultName: string;
  /** Below the selection's end, relative to the editor wrapper. */
  top: number;
  left: number;
};

const POPOVER_WIDTH = 260;

const editorWrapCSS = css`
  position: relative;
  .decision-make-variable {
    position: absolute;
    z-index: 2;
    width: ${POPOVER_WIDTH}px;
    padding: var(--global-dimension-size-100);
    background-color: var(--global-popover-background-color);
    border: 1px solid var(--global-popover-border-color);
    border-radius: var(--global-rounding-medium);
    box-shadow: 0 4px 12px var(--global-overlay-shadow-color);
  }
  .decision-make-variable__row {
    display: flex;
    align-items: start;
    gap: var(--global-dimension-size-100);
  }
  .decision-make-variable__row > :first-child {
    flex: 1 1 auto;
  }
`;

/** The text right before a selection, when it reads like `name:` or `name =`. */
function getLabelBefore(textBefore: string): string | null {
  return textBefore.match(/([A-Za-z_][\w-]*)\s*[:=]\s*$/)?.[1] ?? null;
}

/**
 * What a selection makes a variable of. In JSON: a whole value becomes a
 * hole (`"{{name}}"`), named after its property; part of a string's text
 * becomes a tag inside the string. In text: the selected text becomes a tag.
 */
function getMakeVariableTarget({
  update,
  mode,
  templateFormat,
  existingNames,
}: {
  update: ViewUpdate;
  mode: DecisionStateDraft["mode"];
  templateFormat: TemplateFormat;
  existingNames: readonly string[];
}): Omit<MakeVariableTarget, "top" | "left"> | null {
  const { state } = update;
  const { from, to } = state.selection.main;
  if (from === to) return null;
  const toTag = (name: string) => templateVariable({ name, templateFormat });
  // A selection that already is one tag has nothing to make.
  const isTag = (text: string) =>
    getWholeTagPath({ templateFormat, text: text.trim() }) != null;
  if (mode === "text") {
    if (isTag(state.doc.sliceString(from, to))) return null;
    const line = state.doc.lineAt(from);
    const label = getLabelBefore(state.doc.sliceString(line.from, from));
    return {
      from,
      to,
      toReplacement: toTag,
      value: toDecisionVariableText(state.doc.sliceString(from, to)),
      defaultName: getDefaultVariableName({ hint: label, existingNames }),
    };
  }
  const selection = findJsonValueSelection({ state, from, to });
  if (!selection) return null;
  if (selection.kind === "text" && isTag(selection.source)) return null;
  const defaultName = getDefaultVariableName({
    hint: selection.propertyName,
    existingNames,
  });
  if (selection.kind === "text") {
    return {
      from: selection.from,
      to: selection.to,
      toReplacement: toTag,
      value: toDecisionVariableText(selection.source),
      defaultName,
    };
  }
  let parsed: unknown = selection.source;
  let isParsed = false;
  try {
    parsed = JSON.parse(selection.source);
    isParsed = true;
  } catch {
    // A value being edited is kept as written.
  }
  if (typeof parsed === "string" && isTag(parsed)) return null;
  return {
    from: selection.from,
    to: selection.to,
    // A hole is a JSON string that is exactly the tag.
    toReplacement: (name) => JSON.stringify(toTag(name)),
    // A string is its text; anything else is its JSON.
    value: isParsed
      ? toDecisionVariableText(parsed)
      : { text: selection.source, isReadAsText: false },
    defaultName,
  };
}

function MakeVariablePopover({
  target,
  templateFormat,
  existingNames,
  inputRef,
  onApply,
  onDismiss,
}: {
  target: MakeVariableTarget;
  templateFormat: TemplateFormat;
  existingNames: readonly string[];
  inputRef: React.RefObject<HTMLInputElement | null>;
  onApply: (name: string) => void;
  onDismiss: () => void;
}) {
  const [name, setName] = useState(target.defaultName);
  const trimmedName = name.trim();
  const isNameValid = isValidVariableName(trimmedName);
  const isExisting = existingNames.includes(trimmedName);
  const style = { top: target.top, left: target.left };
  if (templateFormat === TemplateFormats.NONE) {
    return (
      <div className="decision-make-variable" style={style} role="note">
        <Text size="XS" color="text-700">
          The template format is None, so nothing in the state is read as a
          variable. Pick Mustache or F-String to make one.
        </Text>
      </div>
    );
  }
  return (
    <form
      className="decision-make-variable"
      style={style}
      aria-label="Make a variable"
      onSubmit={(event) => {
        event.preventDefault();
        if (isNameValid) onApply(trimmedName);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onDismiss();
        }
      }}
    >
      <div className="decision-make-variable__row">
        <TextField
          size="S"
          aria-label="Variable name"
          value={name}
          onChange={setName}
          isInvalid={trimmedName !== "" && !isNameValid}
        >
          <Input ref={inputRef} placeholder="Make a variable named…" />
          {trimmedName !== "" && !isNameValid ? (
            <FieldError>Use letters, digits and _</FieldError>
          ) : null}
        </TextField>
        <Button size="S" type="submit" isDisabled={!isNameValid}>
          <KeyboardToken>↵</KeyboardToken>
        </Button>
      </div>
      <Text size="XS" color="text-700">
        {isExisting
          ? `Uses the variable ${trimmedName} already has.`
          : "The selection becomes this variable's value. Alt+Enter from the editor."}
      </Text>
    </form>
  );
}

/**
 * The state template's editor: the template editor in Text mode, a JSON
 * editor in JSON mode. Selecting part of the template offers to make it a
 * variable; an empty JSON state over a dataset can be built from the
 * examples' keys.
 */
export function DecisionStateEditor({
  editorKey,
  state,
  templateFormat,
  isDisabled,
  availablePaths,
  existingNames,
  onChange,
  onBlur,
}: {
  /** Remounts the editor when the draft is replaced. */
  editorKey: string;
  state: DecisionStateDraft;
  templateFormat: TemplateFormat;
  isDisabled: boolean;
  availablePaths?: string[];
  /** The playground's variables, which a new variable's name avoids. */
  existingNames: readonly string[];
  onChange: (state: DecisionStateDraft) => void;
  onBlur: () => void;
}) {
  const setVariableValue = usePlaygroundContext(
    (store) => store.setVariableValue
  );
  const setVariableReadAsText = usePlaygroundContext(
    (store) => store.setVariableReadAsText
  );
  const datasetId = usePlaygroundContext((store) => store.datasetId);
  const exampleVariables = usePlaygroundContext((store) =>
    store.datasetId != null
      ? store.stateByDatasetId[store.datasetId]?.exampleVariables
      : undefined
  );
  const wrapperRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [target, setTarget] = useState<MakeVariableTarget | null>(null);
  const [isFocusWithin, setIsFocusWithin] = useState(false);

  const handleUpdate = (update: ViewUpdate) => {
    if (!update.selectionSet && !update.docChanged) return;
    const next = getMakeVariableTarget({
      update,
      mode: state.mode,
      templateFormat,
      existingNames,
    });
    if (!next) {
      setTarget(null);
      return;
    }
    update.view.requestMeasure({
      read: (view) => ({
        coords: view.coordsAtPos(next.to),
        wrapper: wrapperRef.current?.getBoundingClientRect() ?? null,
      }),
      write: ({ coords, wrapper }) => {
        if (!coords || !wrapper) return;
        const maxLeft = Math.max(0, wrapper.width - POPOVER_WIDTH);
        setTarget({
          ...next,
          top: coords.bottom - wrapper.top + 4,
          left: Math.min(Math.max(0, coords.left - wrapper.left), maxLeft),
        });
      },
    });
  };

  // A stable listener: react-codemirror reconfigures the editor whenever
  // `onUpdate` changes.
  const handleUpdateRef = useRef(handleUpdate);
  useEffect(() => {
    handleUpdateRef.current = handleUpdate;
  });

  const applyVariable = (name: string) => {
    const view = viewRef.current;
    if (!view || !target) return;
    const insert = target.toReplacement(name);
    view.dispatch({
      changes: { from: target.from, to: target.to, insert },
      selection: { anchor: target.from + insert.length },
    });
    // A name already in use keeps its value; the selection now reads it.
    if (!existingNames.includes(name)) {
      setVariableValue(name, target.value.text);
      setVariableReadAsText(name, target.value.isReadAsText);
    }
    setTarget(null);
    view.focus();
  };

  const exampleNames = exampleVariables
    ? getExampleVariableNames(exampleVariables).filter(isValidVariableName)
    : [];
  const canBuildFromDataset =
    state.mode === "json" &&
    !state.json.trim() &&
    datasetId != null &&
    exampleNames.length > 0;
  const buildFromDataset = () => {
    const json = toJsonTemplateOfVariables({
      names: exampleNames,
      templateFormat,
    });
    const view = viewRef.current;
    if (view) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: json },
      });
    } else {
      onChange({ ...state, json });
    }
  };

  const editorProps = {
    onCreateEditor: (view: EditorView) => {
      viewRef.current = view;
    },
    onUpdate: (update: ViewUpdate) => handleUpdateRef.current(update),
    onBlur,
    readOnly: isDisabled,
  };

  return (
    <div
      ref={wrapperRef}
      css={editorWrapCSS}
      onFocus={() => setIsFocusWithin(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsFocusWithin(false);
        }
      }}
      onKeyDownCapture={(event) => {
        // Alt+Enter moves from the editor to the name field.
        if (event.key === "Enter" && event.altKey && target) {
          event.preventDefault();
          inputRef.current?.focus();
        }
      }}
    >
      <TemplateEditorWrap readOnly={isDisabled}>
        {state.mode === "text" ? (
          <TemplateEditor
            key={`text-${editorKey}-${templateFormat}`}
            aria-label="Decision state"
            templateFormat={templateFormat}
            defaultValue={state.text}
            placeholder="The evidence the questions are asked about"
            onChange={(text) => onChange({ ...state, text })}
            availablePaths={availablePaths}
            {...editorProps}
          />
        ) : (
          <DecisionJsonTemplateEditor
            key={`json-${editorKey}`}
            aria-label="Decision state"
            templateFormat={templateFormat}
            defaultValue={state.json}
            placeholder={'{"ticket": "{{ticket}}"}'}
            onChange={(json) => onChange({ ...state, json })}
            {...editorProps}
          />
        )}
      </TemplateEditorWrap>
      {canBuildFromDataset ? (
        <Flex
          direction="row"
          gap="size-100"
          alignItems="center"
          justifyContent="end"
        >
          <Text size="XS" color="text-700">
            {templateFormat === TemplateFormats.NONE
              ? "Pick Mustache or F-String to build the state from the dataset."
              : `One hole per key of the examples: ${exampleNames.join(", ")}`}
          </Text>
          <Button
            size="S"
            leadingVisual={<Icon svg={<Icons.Database />} />}
            isDisabled={isDisabled || templateFormat === TemplateFormats.NONE}
            onPress={buildFromDataset}
          >
            Build from dataset
          </Button>
        </Flex>
      ) : null}
      {target && isFocusWithin && !isDisabled ? (
        <MakeVariablePopover
          key={`${target.from}-${target.to}`}
          target={target}
          templateFormat={templateFormat}
          existingNames={existingNames}
          inputRef={inputRef}
          onApply={applyVariable}
          onDismiss={() => {
            setTarget(null);
            viewRef.current?.focus();
          }}
        />
      ) : null}
    </div>
  );
}
