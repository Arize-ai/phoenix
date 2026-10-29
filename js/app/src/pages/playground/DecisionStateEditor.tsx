import type { EditorView } from "@uiw/react-codemirror";
import { useRef } from "react";

import { Button, Flex, Icon, Icons, Text } from "@phoenix/components";
import { DecisionJsonTemplateEditor } from "@phoenix/components/decision/DecisionJsonTemplateEditor";
import {
  TemplateEditor,
  TemplateEditorWrap,
} from "@phoenix/components/templateEditor";
import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import type { DecisionStateDraft } from "@phoenix/store/playground/types";

import {
  getExampleVariableNames,
  isValidVariableName,
  toJsonTemplateOfVariables,
} from "./decisionUtils";

/**
 * The state template's editor: the template editor in Text mode, a JSON
 * editor in JSON mode. An empty JSON state over a dataset can be built from
 * the examples' keys.
 */
export function DecisionStateEditor({
  editorKey,
  state,
  templateFormat,
  isDisabled,
  availablePaths,
  onChange,
  onFocusChange,
}: {
  /** Remounts the editor when the draft is replaced. */
  editorKey: string;
  state: DecisionStateDraft;
  templateFormat: TemplateFormat;
  isDisabled: boolean;
  availablePaths?: string[];
  onChange: (state: DecisionStateDraft) => void;
  /** Focus entering or leaving the editor. */
  onFocusChange: (isFocused: boolean) => void;
}) {
  const datasetId = usePlaygroundContext((store) => store.datasetId);
  const exampleVariables = usePlaygroundContext((store) =>
    store.datasetId != null
      ? store.stateByDatasetId[store.datasetId]?.exampleVariables
      : undefined
  );
  const viewRef = useRef<EditorView | null>(null);

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
    readOnly: isDisabled,
  };

  return (
    <div
      onFocus={() => onFocusChange(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          onFocusChange(false);
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
              : `One variable per key of the examples: ${exampleNames.join(", ")}`}
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
    </div>
  );
}
