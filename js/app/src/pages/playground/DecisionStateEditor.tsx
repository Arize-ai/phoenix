import { DecisionJsonTemplateEditor } from "@phoenix/components/decision/DecisionJsonTemplateEditor";
import {
  TemplateEditor,
  TemplateEditorWrap,
} from "@phoenix/components/templateEditor";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import type { DecisionStateDraft } from "@phoenix/store/playground/types";

/**
 * The state template's editor: the template editor in Text mode, a JSON
 * editor in JSON mode.
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
            readOnly={isDisabled}
          />
        ) : (
          <DecisionJsonTemplateEditor
            key={`json-${editorKey}`}
            aria-label="Decision state"
            templateFormat={templateFormat}
            defaultValue={state.json}
            placeholder={'{"ticket": "{{ticket}}"}'}
            onChange={(json) => onChange({ ...state, json })}
            availablePaths={availablePaths}
            readOnly={isDisabled}
          />
        )}
      </TemplateEditorWrap>
    </div>
  );
}
