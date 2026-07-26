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
import { useCodeMirrorCollapsibleContent } from "./useCodeMirrorCollapsibleContent";

type JSONBlockProps = Omit<
  ReactCodeMirrorProps,
  "theme" | "extensions" | "editable" | "basicSetup"
> & {
  basicSetup?: Partial<BasicSetupOptions>;
};

export function JSONBlock(props: JSONBlockProps) {
  const {
    basicSetup: propsBasicSetup,
    onCreateEditor: propsOnCreateEditor,
    ...rest
  } = props;
  const { theme } = useTheme();
  const onCreateEditor = useCodeMirrorCollapsibleContent({
    onCreateEditor: propsOnCreateEditor,
  });
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
  return (
    <CodeMirror
      value={props.value}
      extensions={[json(), EditorView.lineWrapping, linter(jsonParseLinter())]}
      editable={false}
      theme={codeMirrorTheme}
      onCreateEditor={onCreateEditor}
      {...rest}
      basicSetup={basicSetup}
    />
  );
}
