import React from "react";
import { python } from "@codemirror/lang-python";
import { nord } from "@uiw/codemirror-theme-nord";
import CodeMirror, { ReactCodeMirrorProps } from "@uiw/react-codemirror";

import { useTheme } from "@phoenix/contexts";

import { readOnlyCodeMirrorCSS } from "./styles";

type PythonBlockProps = Omit<
  ReactCodeMirrorProps,
  "theme" | "extensions" | "editable" | "basicSetup"
>;

export function PythonBlock(props: PythonBlockProps) {
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? undefined : nord;
  return (
    <CodeMirror
      value={props.value}
      extensions={[python()]}
      editable={false}
      theme={codeMirrorTheme}
      {...props}
      basicSetup={{
        lineNumbers: false,
        foldGutter: true,
        bracketMatching: true,
        syntaxHighlighting: true,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
      }}
      css={readOnlyCodeMirrorCSS}
    />
  );
}
