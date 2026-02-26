import { type StringStream, StreamLanguage } from "@codemirror/language";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import type {
  BasicSetupOptions,
  ReactCodeMirrorProps,
} from "@uiw/react-codemirror";
import CodeMirror from "@uiw/react-codemirror";
import { useMemo } from "react";

import { useTheme } from "@phoenix/contexts";

type BashBlockProps = Omit<
  ReactCodeMirrorProps,
  "theme" | "extensions" | "editable"
> & {
  basicSetup?: BasicSetupOptions;
};

type ShellState = {
  tokens: unknown[];
};

const shellWithPip = {
  ...shell,
  token(stream: StringStream, state: ShellState) {
    const token = shell.token(stream, state);
    // The legacy shell mode doesn't mark `pip` as builtin.
    // Re-map this token so `pip install ...` highlights like `npm install ...`.
    if (token == null && stream.current() === "pip") {
      return "builtin";
    }
    return token;
  },
};

export function BashBlock(props: BashBlockProps) {
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? githubLight : githubDark;
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
      extensions={[StreamLanguage.define(shellWithPip)]}
      editable={false}
      theme={codeMirrorTheme}
      {...props}
      basicSetup={basicSetup}
    />
  );
}
