import { StreamLanguage } from "@codemirror/language";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import type {
  BasicSetupOptions,
  ReactCodeMirrorProps,
} from "@uiw/react-codemirror";
import CodeMirror from "@uiw/react-codemirror";
import { useMemo } from "react";

import { useTheme } from "@phoenix/contexts";

import { pierreDark, pierreLight } from "./pierreCodeMirrorTheme";

type TomlBlockProps = Omit<
  ReactCodeMirrorProps,
  "theme" | "extensions" | "editable"
> & {
  basicSetup?: BasicSetupOptions;
};

export function TomlBlock(props: TomlBlockProps) {
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? pierreLight : pierreDark;
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
      extensions={[StreamLanguage.define(toml)]}
      editable={false}
      theme={codeMirrorTheme}
      {...props}
      basicSetup={basicSetup}
    />
  );
}
