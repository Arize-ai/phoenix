import { useEffect, useRef, useState } from "react";
import { defaultKeymap } from "@codemirror/commands";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import ReactCodeMirror, {
  BasicSetupOptions,
  EditorView,
  keymap,
} from "@uiw/react-codemirror";

import { Field } from "@arizeai/components";

import { CodeWrap } from "@phoenix/components/code";
import { useTheme } from "@phoenix/contexts";

type VariableEditorProps = {
  label?: string;
  defaultValue: string;
  onChange?: (value: string) => void;
};

const basicSetupOptions: BasicSetupOptions = {
  lineNumbers: false,
  highlightActiveLine: false,
  foldGutter: false,
  highlightActiveLineGutter: false,
  bracketMatching: false,
  syntaxHighlighting: false,
  defaultKeymap: false,
};

const extensions = [
  EditorView.lineWrapping,
  keymap.of([
    // Reserve Mod-Enter for the submit button
    ...defaultKeymap.filter((binding) => binding.key !== "Mod-Enter"),
  ]),
];

/**
 * A mostly uncontrolled editor that re-mounts when the label changes.
 *
 * The re-mount ensures that value is reset to the initial value when the label (variable name) changes.
 *
 * This is necessary because controlled react-codemirror editors incessantly remount and reset
 * cursor position when value is updated.
 */
export const VariableEditor = ({
  label,
  defaultValue,
  onChange,
}: VariableEditorProps) => {
  const { theme } = useTheme();
  const valueRef = useRef(defaultValue);
  const [version, setVersion] = useState(0);
  const [initialValue, setInitialValue] = useState(() => defaultValue);
  useEffect(() => {
    if (defaultValue == null) {
      setInitialValue("");
      setVersion((prev) => prev + 1);
    }
    valueRef.current = defaultValue;
  }, [defaultValue]);
  useEffect(() => {
    setInitialValue(valueRef.current);
    setVersion((prev) => prev + 1);
  }, [label]);
  const codeMirrorTheme = theme === "light" ? githubLight : githubDark;
  return (
    <Field label={label}>
      <CodeWrap width="100%">
        <ReactCodeMirror
          key={version}
          theme={codeMirrorTheme}
          basicSetup={basicSetupOptions}
          value={initialValue}
          extensions={extensions}
          onChange={onChange}
        />
      </CodeWrap>
    </Field>
  );
};
