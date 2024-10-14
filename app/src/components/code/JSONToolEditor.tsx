import React from "react";
import { json, jsonLanguage, jsonParseLinter } from "@codemirror/lang-json";
import { linter } from "@codemirror/lint";
import { EditorView, hoverTooltip } from "@codemirror/view";
import { nord } from "@uiw/codemirror-theme-nord";
import CodeMirror, { ReactCodeMirrorProps } from "@uiw/react-codemirror";
import {
  handleRefresh,
  jsonCompletion,
  jsonSchemaHover,
  jsonSchemaLinter,
  stateExtensions,
} from "codemirror-json-schema";

import { useTheme } from "@phoenix/contexts";
import { toolJSONSchema } from "@phoenix/schemas/toolSchema";

export type JSONToolEditorProps = Omit<
  ReactCodeMirrorProps,
  "theme" | "extensions" | "editable"
>;

export function JSONToolEditor(props: JSONToolEditorProps) {
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? undefined : nord;
  return (
    <CodeMirror
      value={props.value}
      extensions={[
        json(),
        EditorView.lineWrapping,
        linter(jsonParseLinter()),
        linter(jsonSchemaLinter(), { needsRefresh: handleRefresh }),
        jsonLanguage.data.of({
          autocomplete: jsonCompletion(),
        }),
        hoverTooltip(jsonSchemaHover()),
        stateExtensions(toolJSONSchema as JSONSchema7),
      ]}
      editable
      theme={codeMirrorTheme}
      {...props}
    />
  );
}
