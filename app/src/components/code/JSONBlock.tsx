import React from "react";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter } from "@codemirror/lint";
import { EditorView } from "@codemirror/view";
import { nord } from "@uiw/codemirror-theme-nord";
import CodeMirror, { ReactCodeMirrorProps } from "@uiw/react-codemirror";
import { css } from "@emotion/react";

import { useTheme } from "@phoenix/contexts";

type JSONBlockProps = Omit<
  ReactCodeMirrorProps,
  "theme" | "extensions" | "editable" | "basicSetup"
>;

const codeMirrorCSS = css`
  .cm-content {
    padding: var(--ac-global-dimension-static-size-200) 0;
  }
  .cm-editor,
  .cm-gutters {
    background-color: transparent;
  }
`;

export function JSONBlock(props: JSONBlockProps) {
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? undefined : nord;
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
      css={codeMirrorCSS}
    />
  );
}
