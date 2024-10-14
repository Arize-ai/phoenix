import React, { useMemo } from "react";
import { githubLight } from "@uiw/codemirror-theme-github";
import { nord } from "@uiw/codemirror-theme-nord";
import CodeMirror, {
  BasicSetupOptions,
  ReactCodeMirrorProps,
} from "@uiw/react-codemirror";

import { useTheme } from "@phoenix/contexts";
import { assertUnreachable } from "@phoenix/typeUtils";

import { FStringTemplating } from "./language/fString";
import { MustacheLikeTemplating } from "./language/mustacheLike";

export const TemplateLanguages = {
  FString: "f-string", // {variable}
  Mustache: "mustache", // {{variable}}
} as const;

type TemplateLanguage =
  (typeof TemplateLanguages)[keyof typeof TemplateLanguages];

type TemplateEditorProps = ReactCodeMirrorProps & {
  templateLanguage: TemplateLanguage;
};

const basicSetupOptions: BasicSetupOptions = {
  lineNumbers: false,
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
    const ext: TemplateEditorProps["extensions"] = [];
    switch (templateLanguage) {
      case TemplateLanguages.FString:
        ext.push(FStringTemplating());
        break;
      case TemplateLanguages.Mustache:
        ext.push(MustacheLikeTemplating());
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
