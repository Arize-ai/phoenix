import React from "react";
import { javascript } from "@codemirror/lang-javascript";
import { nord } from "@uiw/codemirror-theme-nord";
import CodeMirror, { ReactCodeMirrorProps } from "@uiw/react-codemirror";

import { useTheme } from "@phoenix/contexts";

import { readOnlyCodeMirrorCSS } from "./styles";

type TypeScriptBlockProps = Omit<
  ReactCodeMirrorProps,
  "theme" | "extensions" | "editable" | "basicSetup"
>;

export function TypeScriptBlock(props: TypeScriptBlockProps) {
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? undefined : nord;
  return (
    <CodeMirror
      value={props.value}
      extensions={[javascript({ typescript: true })]}
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
