import React from "react";
import { nord } from "@uiw/codemirror-theme-nord";
import ReactCodeMirror, { ReactCodeMirrorProps } from "@uiw/react-codemirror";

import { useTheme } from "@phoenix/contexts";

import { mustache } from "./lang-mustache";
import { readOnlyCodeMirrorCSS } from "./styles";

type MustacheBlockProps = Omit<
  ReactCodeMirrorProps,
  "theme" | "extensions" | "editable" | "basicSetup"
>;

export function MustacheEditor(props: MustacheBlockProps) {
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? undefined : nord;
  return (
    <ReactCodeMirror
      value={props.value}
      extensions={[mustache()]}
      editable={true}
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
