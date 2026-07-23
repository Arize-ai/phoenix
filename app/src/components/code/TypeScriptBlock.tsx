import { javascript } from "@codemirror/lang-javascript";
import type {
  BasicSetupOptions,
  ReactCodeMirrorProps,
} from "@uiw/react-codemirror";
import CodeMirror from "@uiw/react-codemirror";
import { useMemo } from "react";

import { useTheme } from "@phoenix/contexts";

import { pierreDark, pierreLight } from "./pierreCodeMirrorTheme";

type TypeScriptBlockProps = Omit<
  ReactCodeMirrorProps,
  "theme" | "extensions" | "editable"
> & {
  basicSetup?: BasicSetupOptions;
};

export function TypeScriptBlock(props: TypeScriptBlockProps) {
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? pierreLight : pierreDark;
  const { basicSetup: propsBasicSetup } = props;

  const basicSetup = useMemo(() => {
    return {
      lineNumbers: false,
      foldGutter: true,
      bracketMatching: true,
      syntaxHighlighting: true,
      highlightActiveLine: false,
      highlightActiveLineGutter: false,
      ...(typeof propsBasicSetup === "object" ? propsBasicSetup : {}),
    };
  }, [propsBasicSetup]);
  return (
    <CodeMirror
      value={props.value}
      extensions={[javascript({ typescript: true })]}
      editable={false}
      theme={codeMirrorTheme}
      {...props}
      basicSetup={basicSetup}
    />
  );
}
