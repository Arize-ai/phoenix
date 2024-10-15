import React from "react";
import { githubLight } from "@uiw/codemirror-theme-github";
import { nord } from "@uiw/codemirror-theme-nord";
import ReactCodeMirror, {
  BasicSetupOptions,
  EditorView,
} from "@uiw/react-codemirror";
import { css } from "@emotion/react";

import { Field } from "@arizeai/components";

import { useTheme } from "@phoenix/contexts";

type VariableEditorProps = {
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
};

const basicSetupOptions: BasicSetupOptions = {
  lineNumbers: false,
  highlightActiveLine: false,
  foldGutter: false,
  highlightActiveLineGutter: false,
  bracketMatching: false,
  syntaxHighlighting: false,
};

const extensions = [EditorView.lineWrapping];

export const VariableEditor = ({
  label,
  value,
  onChange,
}: VariableEditorProps) => {
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? githubLight : nord;
  return (
    <Field label={label}>
      <div
        css={css`
          width: 100%;
        `}
      >
        <ReactCodeMirror
          theme={codeMirrorTheme}
          basicSetup={basicSetupOptions}
          value={value}
          extensions={extensions}
          onChange={onChange}
        />
      </div>
    </Field>
  );
};
