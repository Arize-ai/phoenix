import React from "react";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter } from "@codemirror/lint";
import { EditorView } from "@codemirror/view";
import { nord } from "@uiw/codemirror-theme-nord";
import CodeMirror, { ReactCodeMirrorProps } from "@uiw/react-codemirror";

import { useTheme } from "@phoenix/contexts";

type JSONEditorProps = Omit<
  ReactCodeMirrorProps,
  "theme" | "extensions" | "editable"
>;

export function JSONEditor(props: JSONEditorProps) {
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? undefined : nord;
  return (
    <CodeMirror
      value={props.value}
      extensions={[json(), EditorView.lineWrapping, linter(jsonParseLinter())]}
      editable
      theme={codeMirrorTheme}
      {...props}
    />
  );
}
