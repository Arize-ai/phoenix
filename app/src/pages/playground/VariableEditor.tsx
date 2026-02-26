import { defaultKeymap } from "@codemirror/commands";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import type { BasicSetupOptions } from "@uiw/react-codemirror";
import ReactCodeMirror, { EditorView, keymap } from "@uiw/react-codemirror";
import { useMemo } from "react";

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
 * A mostly uncontrolled editor that re-mounts when the label changes.
 *
 * The re-mount ensures that value is reset to the initial value when the label (variable name) changes.
 *
 * This is necessary because controlled react-codemirror editors incessantly remount and reset
 * cursor position when value is updated.
 */
export const VariableEditor = ({
  label,
  defaultValue,
  onChange,
}: VariableEditorProps) => {
  const { theme } = useTheme();
  const editorValue = defaultValue ?? "";
  const editorKey = useMemo(
    () => `${label ?? ""}::${editorValue}`,
    [editorValue, label]
  );
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
