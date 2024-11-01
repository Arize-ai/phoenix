import React, { useEffect, useMemo } from "react";
import { json, jsonLanguage, jsonParseLinter } from "@codemirror/lang-json";
import { linter } from "@codemirror/lint";
import { EditorView, hoverTooltip } from "@codemirror/view";
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
  jsonSchema?: JSONSchema7;
};

export function JSONEditor(props: JSONEditorProps) {
  const { theme } = useTheme();
  const { jsonSchema, ...restProps } = props;
  const codeMirrorTheme = theme === "light" ? githubLight : nord;
  // Force a refresh of the editor when the jsonSchema changes
  // Code mirror does not automatically refresh when the extensions change
  const [schemaKey, setSchemaKey] = React.useState(0);
  useEffect(() => {
    setSchemaKey((prev) => prev + 1);
  }, [jsonSchema]);
  const extensions = useMemo(() => {
    const baseExtensions = [
      json(),
      EditorView.lineWrapping,
      linter(jsonParseLinter()),
    ];

    if (jsonSchema) {
      baseExtensions.push(
        linter(jsonSchemaLinter(), { needsRefresh: handleRefresh }),
        jsonLanguage.data.of({
          autocomplete: jsonCompletion({}),
        }),
        hoverTooltip(jsonSchemaHover()),
        stateExtensions(jsonSchema)
      );
    }
    return baseExtensions;
  }, [jsonSchema]);

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
