import React, { useMemo } from "react";
import { python } from "@codemirror/lang-python";
import { nord } from "@uiw/codemirror-theme-nord";
import CodeMirror, {
  BasicSetupOptions,
  ReactCodeMirrorProps,
} from "@uiw/react-codemirror";

import { useTheme } from "@phoenix/contexts";

import { readOnlyCodeMirrorCSS } from "./styles";
type PythonBlockProps = Omit<
  ReactCodeMirrorProps,
  "theme" | "extensions" | "editable"
> & {
  basicSetup?: BasicSetupOptions;
};

export function PythonBlock(props: PythonBlockProps) {
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? undefined : nord;
  const { basicSetup: propsBasicSetup = {} } = props;
  const basicSetup = useMemo(() => {
    return {
      lineNumbers: false,
      foldGutter: true,
      bracketMatching: true,
      syntaxHighlighting: true,
      highlightActiveLine: false,
      highlightActiveLineGutter: false,
      ...(propsBasicSetup as object),
    };
  }, [propsBasicSetup]);

  return (
    <CodeMirror
      value={props.value}
      extensions={[python()]}
      editable={false}
      theme={codeMirrorTheme}
      {...props}
      basicSetup={basicSetup}
      css={readOnlyCodeMirrorCSS}
    />
  );
}
