import React from "react";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter } from "@codemirror/lint";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import CodeMirror, {
  EditorView,
  ReactCodeMirrorProps,
} from "@uiw/react-codemirror";

import { useTheme } from "@phoenix/contexts";

type JSONBlockProps = Omit<
  ReactCodeMirrorProps,
  "theme" | "extensions" | "editable" | "basicSetup"
>;

export function JSONBlock(props: JSONBlockProps) {
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? githubLight : githubDark;
  return (
    <CodeMirror
      value={props.value}
      extensions={[json(), EditorView.lineWrapping, linter(jsonParseLinter())]}
      editable={false}
      theme={codeMirrorTheme}
      {...props}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        bracketMatching: true,
        syntaxHighlighting: true,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
      }}
    />
  );
}
