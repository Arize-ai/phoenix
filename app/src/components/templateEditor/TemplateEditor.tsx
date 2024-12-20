import React, { useMemo } from "react";
import { githubLight } from "@uiw/codemirror-theme-github";
import { nord } from "@uiw/codemirror-theme-nord";
import CodeMirror, {
  BasicSetupOptions,
  EditorView,
  ReactCodeMirrorProps,
} from "@uiw/react-codemirror";
import { css } from "@emotion/react";

import { useTheme } from "@phoenix/contexts";
import { assertUnreachable } from "@phoenix/typeUtils";

import { FStringTemplating } from "./language/fString";
import { MustacheLikeTemplating } from "./language/mustacheLike";
import { TemplateLanguages } from "./constants";
import { TemplateLanguage } from "./types";

type TemplateEditorProps = ReactCodeMirrorProps & {
  templateLanguage: TemplateLanguage;
};

const basicSetupOptions: BasicSetupOptions = {
  lineNumbers: true,
  highlightActiveLine: false,
  foldGutter: false,
  highlightActiveLineGutter: false,
  bracketMatching: false,
};

export const TemplateEditor = ({
  templateLanguage,
  ...props
}: TemplateEditorProps) => {
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? githubLight : nord;
  const extensions = useMemo(() => {
    const ext: TemplateEditorProps["extensions"] = [EditorView.lineWrapping];
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

  return (
    <CodeMirror
      theme={codeMirrorTheme}
      extensions={extensions}
      basicSetup={basicSetupOptions}
      {...props}
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
