import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter } from "@codemirror/lint";
import type {
  BasicSetupOptions,
  ReactCodeMirrorProps,
} from "@uiw/react-codemirror";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { useMemo } from "react";

import { useTheme } from "@phoenix/contexts";

import { pierreDark, pierreLight } from "./pierreCodeMirrorTheme";

type JSONBlockProps = Omit<
  ReactCodeMirrorProps,
  "theme" | "extensions" | "editable" | "basicSetup"
> & {
  basicSetup?: Partial<BasicSetupOptions>;
  /**
   * Whether to underline JSON syntax errors. Off for text that is knowingly
   * not a complete document, such as a truncated preview.
   */
  lint?: boolean;
};

export function JSONBlock(props: JSONBlockProps) {
  const { basicSetup: propsBasicSetup, lint = true, ...rest } = props;
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? pierreLight : pierreDark;
  const basicSetup = useMemo(() => {
    const baseSetup = {
      lineNumbers: true,
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
  const extensions = useMemo(
    () =>
      lint
        ? [json(), EditorView.lineWrapping, linter(jsonParseLinter())]
        : [json(), EditorView.lineWrapping],
    [lint]
  );
  return (
    <CodeMirror
      value={props.value}
      extensions={extensions}
      editable={false}
      theme={codeMirrorTheme}
      {...rest}
      basicSetup={basicSetup}
    />
  );
}
