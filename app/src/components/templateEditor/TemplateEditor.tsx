import React, { useEffect, useMemo, useState } from "react";
import { defaultKeymap } from "@codemirror/commands";
import { githubLight } from "@uiw/codemirror-theme-github";
import { nord } from "@uiw/codemirror-theme-nord";
import CodeMirror, {
  BasicSetupOptions,
  EditorView,
  keymap,
  ReactCodeMirrorProps,
} from "@uiw/react-codemirror";
import { css } from "@emotion/react";

import { useTheme } from "@phoenix/contexts";
import { assertUnreachable } from "@phoenix/typeUtils";

import { FStringTemplating } from "./language/fString";
import { MustacheLikeTemplating } from "./language/mustacheLike";
import { TemplateLanguages } from "./constants";
import { TemplateLanguage } from "./types";

type TemplateEditorProps = Omit<ReactCodeMirrorProps, "value"> & {
  templateLanguage: TemplateLanguage;
  defaultValue: string;
};

const basicSetupOptions: BasicSetupOptions = {
  lineNumbers: true,
  highlightActiveLine: false,
  foldGutter: false,
  highlightActiveLineGutter: false,
  bracketMatching: false,
  defaultKeymap: false,
};

const baseExtensions = [
  EditorView.lineWrapping,
  keymap.of([
    ...defaultKeymap.filter((binding) => binding.key !== "Mod-Enter"),
  ]),
];

/**
 * A template editor that is used to edit the template of a tool.
 *
 * This is an uncontrolled editor.
 * You can only reset the value of the editor by triggering a re-mount, like with the `key` prop,
 * or, when the readOnly prop is true, the editor will reset on all value changes.
 * This is necessary because controlled react-codemirror editors incessantly reset
 * cursor position when value is updated.
 */
export const TemplateEditor = ({
  templateLanguage,
  defaultValue,
  readOnly,
  ...props
}: TemplateEditorProps) => {
  const [value, setValue] = useState(() => defaultValue);
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? githubLight : nord;
  const extensions = useMemo(() => {
    const ext: TemplateEditorProps["extensions"] = baseExtensions;
    switch (templateLanguage) {
      case TemplateLanguages.FString:
        ext.push(FStringTemplating());
        break;
      case TemplateLanguages.Mustache:
        ext.push(MustacheLikeTemplating());
        break;
      case TemplateLanguages.NONE:
        break;
      default:
        assertUnreachable(templateLanguage);
    }
    return ext;
  }, [templateLanguage]);

  useEffect(() => {
    if (readOnly) {
      setValue(defaultValue);
    }
  }, [readOnly, defaultValue]);

  return (
    <CodeMirror
      theme={codeMirrorTheme}
      extensions={extensions}
      basicSetup={basicSetupOptions}
      readOnly={readOnly}
      {...props}
      value={value}
    />
  );
};

export const TemplateEditorWrap = ({
  readOnly,
  children,
}: {
  readOnly?: boolean;
  children: React.ReactNode;
}) => {
  return (
    <div
      css={css`
        & .cm-editor,
        & .cm-gutters {
          background-color: ${!readOnly ? "auto" : "transparent !important"};
        }
        & .cm-gutters {
          border-right: none !important;
        }
        & .cm-content {
          padding: var(--ac-global-dimension-size-100)
            var(--ac-global-dimension-size-250);
        }
        & .cm-gutter,
        & .cm-content {
          min-height: ${!readOnly ? "75px" : "100%"};
        }
        & .cm-line {
          padding-left: 0;
          padding-right: 0;
        }
        & .cm-cursor {
          display: ${!readOnly ? "auto" : "none !important"};
        }
      `}
    >
      {children}
    </div>
  );
};
