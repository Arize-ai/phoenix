import { defaultKeymap } from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import type { ReactCodeMirrorProps } from "@uiw/react-codemirror";
import CodeMirror, { EditorView, keymap } from "@uiw/react-codemirror";
import { useMemo } from "react";

import { useTheme } from "@phoenix/contexts";

export type PythonEditorProps = Omit<
  ReactCodeMirrorProps,
  "theme" | "extensions" | "editable"
> & {
  isReadOnly?: boolean;
};

export function PythonEditor(props: PythonEditorProps) {
  const { theme } = useTheme();
  const { isReadOnly, basicSetup, ...restProps } = props;
  const codeMirrorTheme = theme === "light" ? githubLight : githubDark;
  const extensions = useMemo(
    () => [
      python(),
      EditorView.lineWrapping,
      // Reserve Mod-Enter for the submit button
      keymap.of([
        ...defaultKeymap.filter((binding) => binding.key !== "Mod-Enter"),
      ]),
    ],
    []
  );

  return (
    <CodeMirror
      value={props.value}
      extensions={extensions}
      editable={!isReadOnly}
      theme={codeMirrorTheme}
      basicSetup={{
        ...(basicSetup as object),
        defaultKeymap: false,
      }}
      {...restProps}
    />
  );
}
