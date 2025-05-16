import { useMemo } from "react";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter } from "@codemirror/lint";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import CodeMirror, {
  BasicSetupOptions,
  EditorView,
  ReactCodeMirrorProps,
} from "@uiw/react-codemirror";

import { useTheme } from "@phoenix/contexts";

type JSONBlockProps = Omit<
  ReactCodeMirrorProps,
  "theme" | "extensions" | "editable" | "basicSetup"
> & {
  basicSetup?: Partial<BasicSetupOptions>;
};

export function JSONBlock(props: JSONBlockProps) {
  const { basicSetup: propsBasicSetup, ...rest } = props;
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? githubLight : githubDark;
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
      {...rest}
      basicSetup={basicSetup}
    />
  );
}
