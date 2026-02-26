import { defaultKeymap } from "@codemirror/commands";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import type { BasicSetupOptions } from "@uiw/react-codemirror";
import ReactCodeMirror, { EditorView, keymap } from "@uiw/react-codemirror";

import { Label } from "@phoenix/components";
import { CodeWrap } from "@phoenix/components/code";
import { fieldBaseCSS } from "@phoenix/components/field/styles";
import { useTheme } from "@phoenix/contexts";

type VariableEditorProps = {
  label?: string;
  defaultValue: string;
  onChange?: (value: string) => void;
};

const basicSetupOptions: BasicSetupOptions = {
  lineNumbers: false,
  highlightActiveLine: false,
  foldGutter: false,
  highlightActiveLineGutter: false,
  bracketMatching: false,
  syntaxHighlighting: false,
  defaultKeymap: false,
};

const extensions = [
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
}: VariableEditorProps) => {
  const { theme } = useTheme();
  const editorValue = defaultValue ?? "";
  const editorKey = label ?? "";
  const codeMirrorTheme = theme === "light" ? githubLight : githubDark;
  return (
    <div css={fieldBaseCSS}>
      <Label>{label}</Label>
      <CodeWrap width="100%">
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
