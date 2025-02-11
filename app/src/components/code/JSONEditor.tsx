import React, { useEffect, useMemo } from "react";
import { defaultKeymap } from "@codemirror/commands";
import { json, jsonLanguage, jsonParseLinter } from "@codemirror/lang-json";
import { linter } from "@codemirror/lint";
import { EditorView, hoverTooltip, keymap } from "@codemirror/view";
import { githubLight } from "@uiw/codemirror-theme-github";
import { nord } from "@uiw/codemirror-theme-nord";
import CodeMirror, { ReactCodeMirrorProps } from "@uiw/react-codemirror";
import {
  handleRefresh,
  jsonCompletion,
  jsonSchemaHover,
  jsonSchemaLinter,
  stateExtensions,
} from "codemirror-json-schema";
import { JSONSchema7 } from "json-schema";

import { useTheme } from "@phoenix/contexts";

export type JSONEditorProps = Omit<
  ReactCodeMirrorProps,
  "theme" | "extensions" | "editable"
> & {
  /**
   * JSON Schema to use for validation, if provided will enable JSON Schema validation with tooltips in the editor
   */
  jsonSchema?: JSONSchema7 | null;
  /**
   * If true, will not lint the content if it is empty
   */
  optionalLint?: boolean;
};

export function JSONEditor(props: JSONEditorProps) {
  const { theme } = useTheme();
  const { jsonSchema, optionalLint, ...restProps } = props;
  const codeMirrorTheme = theme === "light" ? githubLight : nord;
  // Force a refresh of the editor when the jsonSchema changes
  // Code mirror does not automatically refresh when the extensions change
  const [schemaKey, setSchemaKey] = React.useState(0);
  useEffect(() => {
    setSchemaKey((prev) => prev + 1);
  }, [jsonSchema]);
  const contentLength = props.value?.length;
  // When optionalLint is false, this value will always be true
  // If optionalLint is true, we only lint when there is content to allow for empty json values
  const shouldLint = !optionalLint || (contentLength && contentLength > 0);
  const extensions = useMemo(() => {
    const baseExtensions = [
      json(),
      EditorView.lineWrapping,
      // Reserve Mod-Enter for the submit button
      keymap.of([
        ...defaultKeymap.filter((binding) => binding.key !== "Mod-Enter"),
      ]),
    ];

    if (shouldLint) {
      baseExtensions.push(linter(jsonParseLinter()));
    }

    if (jsonSchema) {
      baseExtensions.push(
        linter(jsonSchemaLinter(), { needsRefresh: handleRefresh }),
        jsonLanguage.data.of({
          autocomplete: jsonCompletion(),
        }),
        hoverTooltip(jsonSchemaHover()),
        stateExtensions(jsonSchema)
      );
    }
    return baseExtensions;
  }, [jsonSchema, shouldLint]);

  return (
    <CodeMirror
      key={schemaKey}
      value={props.value}
      extensions={extensions}
      editable
      theme={codeMirrorTheme}
      {...restProps}
    />
  );
}
