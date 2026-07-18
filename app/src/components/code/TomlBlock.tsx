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
  "theme" | "extensions" | "editable" | "basicSetup"
> & {
  basicSetup?: Partial<BasicSetupOptions>;
};

const tomlExtensions = [StreamLanguage.define(toml)];

export function TomlBlock(props: TomlBlockProps) {
  const { basicSetup: propsBasicSetup, ...rest } = props;
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? pierreLight : pierreDark;
  const basicSetup = useMemo(() => {
    const baseSetup = {
      lineNumbers: false,
      foldGutter: true,
      bracketMatching: true,
      syntaxHighlighting: true,
      highlightActiveLine: false,
      highlightActiveLineGutter: false,
    };
    if (propsBasicSetup) {
      return { ...baseSetup, ...propsBasicSetup };
    }
    return baseSetup;
  }, [propsBasicSetup]);

  return (
    <CodeMirror
      value={props.value}
      extensions={tomlExtensions}
      editable={false}
      theme={codeMirrorTheme}
      {...rest}
      basicSetup={basicSetup}
    />
  );
}
