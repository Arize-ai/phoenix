import React, { useEffect, useMemo } from "react";
import { nord } from "@uiw/codemirror-theme-nord";
import CodeMirror, { ReactCodeMirrorProps } from "@uiw/react-codemirror";

import { useTheme } from "@phoenix/contexts";
import { assertUnreachable } from "@phoenix/typeUtils";

import {
  debugParser,
  formatFString,
  FStringTemplating,
} from "./language/fStringTemplating";
import { MustacheLikeTemplating } from "./language/mustacheLikeTemplating";

export const TemplateLanguages = {
  FString: "f-string", // {variable}
  Mustache: "mustache", // {{variable}}
} as const;

type TemplateLanguage =
  (typeof TemplateLanguages)[keyof typeof TemplateLanguages];

type TemplateEditorProps = ReactCodeMirrorProps & {
  templateLanguage: TemplateLanguage;
};

export const TemplateEditor = ({
  templateLanguage,
  ...props
}: TemplateEditorProps) => {
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? undefined : nord;
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

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log(debugParser(props.value ?? ""));
    // eslint-disable-next-line no-console
    console.log(
      formatFString({
        text: props.value ?? "",
        variables: { question: "questionValue", test: "testValue" },
      })
    );
  }, [props.value]);

  return (
    <CodeMirror theme={codeMirrorTheme} extensions={extensions} {...props} />
  );
};
