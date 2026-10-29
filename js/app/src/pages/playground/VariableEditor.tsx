import { defaultKeymap } from "@codemirror/commands";
import { css } from "@emotion/react";
import type { BasicSetupOptions } from "@uiw/react-codemirror";
import ReactCodeMirror, { EditorView, keymap } from "@uiw/react-codemirror";
import { useMemo } from "react";

import { Badge, Flex, Label, Switch, Text } from "@phoenix/components";
import { CodeWrap, pierreDark, pierreLight } from "@phoenix/components/code";
import { fieldBaseCSS } from "@phoenix/components/core/field/styles";
import { useTheme } from "@phoenix/contexts";

/** How a decision reads this variable, shown beside its name. */
export type VariableDecisionReading = {
  /** The JSON type the value is sent as, `text`, or `missing` when empty. */
  type: string;
  /** Whether the value parses as JSON, so reading it as text is a choice. */
  isJson: boolean;
  isReadAsText: boolean;
  onReadAsTextChange: (isReadAsText: boolean) => void;
};

type VariableEditorProps = {
  label?: string;
  defaultValue: string;
  onChange?: (value: string) => void;
  /** Shown when a decision reads the variable; prompts read every value as text. */
  decisionReading?: VariableDecisionReading;
};

const labelRowCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  min-height: var(--global-dimension-size-300);
`;

const basicSetupOptions: BasicSetupOptions = {
  lineNumbers: false,
  highlightActiveLine: false,
  foldGutter: false,
  highlightActiveLineGutter: false,
  bracketMatching: false,
  syntaxHighlighting: false,
  defaultKeymap: false,
};

const baseExtensions = [
  EditorView.lineWrapping,
  keymap.of([
    // Reserve Mod-Enter for the submit button
    ...defaultKeymap.filter((binding) => binding.key !== "Mod-Enter"),
  ]),
];

/**
 * A controlled CodeMirror editor keyed by variable name.
 *
 * Re-mounts when the label (variable name) changes so the editor
 * initializes with the correct value for the new variable.
 */
export const VariableEditor = ({
  label,
  defaultValue,
  onChange,
  decisionReading,
}: VariableEditorProps) => {
  const { theme } = useTheme();
  const editorValue = defaultValue ?? "";
  const editorKey = label ?? "";
  const codeMirrorTheme = theme === "light" ? pierreLight : pierreDark;
  // stable identity so CodeMirror only reconfigures when the label changes
  const extensions = useMemo(
    () => [
      ...baseExtensions,
      // name the textbox after its variable for assistive technology
      EditorView.contentAttributes.of({
        "aria-label": label ?? "Variable value",
      }),
    ],
    [label]
  );
  return (
    <div css={fieldBaseCSS}>
      {decisionReading ? (
        <div css={labelRowCSS}>
          <Label>{label}</Label>
          <Badge
            size="S"
            variant={decisionReading.type === "missing" ? "warning" : "default"}
            aria-label={`Decisions read ${label} as ${decisionReading.type}`}
          >
            {decisionReading.type}
          </Badge>
          <Flex flex="1 1 auto" justifyContent="end">
            {decisionReading.isJson ? (
              <Switch
                labelPlacement="start"
                isSelected={decisionReading.isReadAsText}
                onChange={decisionReading.onReadAsTextChange}
              >
                <Text size="XS" color="text-700">
                  Read as text
                </Text>
              </Switch>
            ) : null}
          </Flex>
        </div>
      ) : (
        <Label>{label}</Label>
      )}
      <CodeWrap style={{ width: "100%" }}>
        <ReactCodeMirror
          key={editorKey}
          theme={codeMirrorTheme}
          basicSetup={basicSetupOptions}
          value={editorValue}
          extensions={extensions}
          onChange={onChange}
        />
      </CodeWrap>
    </div>
  );
};
