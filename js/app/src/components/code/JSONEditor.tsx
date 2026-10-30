import { defaultKeymap } from "@codemirror/commands";
import { json, jsonLanguage, jsonParseLinter } from "@codemirror/lang-json";
import { linter } from "@codemirror/lint";
import type { Extension } from "@codemirror/state";
import type { ReactCodeMirrorProps } from "@uiw/react-codemirror";
import CodeMirror, {
  EditorView,
  hoverTooltip,
  keymap,
} from "@uiw/react-codemirror";
import {
  handleRefresh,
  jsonCompletion,
  jsonSchemaHover,
  jsonSchemaLinter,
  stateExtensions,
} from "codemirror-json-schema";
import type { JSONSchema7 } from "json-schema";
import { useMemo } from "react";

import { useTheme } from "@phoenix/contexts";

import { pierreDark, pierreLight } from "./pierreCodeMirrorTheme";

export type JSONEditorProps = Omit<
  ReactCodeMirrorProps,
  "theme" | "extensions" | "editable"
> & {
  /**
   * Extensions added after the editor's own, such as highlighting for the
   * strings' contents. Keep the array stable across renders: a new array
   * reconfigures the editor.
   */
  extensions?: Extension[];
  /**
   * JSON Schema to use for validation, if provided will enable JSON Schema validation with tooltips in the editor
   */
  jsonSchema?: JSONSchema7 | null;
  /**
   * If true, will not lint the content if it is empty
   */
  optionalLint?: boolean;
  /**
   * If false, the editor's own JSON linter is off, for an editor that brings
   * its own in `extensions`
   */
  lint?: boolean;
};

export function JSONEditor(props: JSONEditorProps) {
  const { theme } = useTheme();
  const {
    jsonSchema,
    optionalLint,
    lint = true,
    basicSetup,
    "aria-label": ariaLabel,
    extensions: extraExtensions,
    ...restProps
  } = props;
  const codeMirrorTheme = theme === "light" ? pierreLight : pierreDark;
  const contentLength = props.value?.length;
  // When optionalLint is false, this value will always be true
  // If optionalLint is true, we only lint when there is content to allow for empty json values
  const shouldLint =
    lint && (!optionalLint || (contentLength && contentLength > 0));
  const extensions = useMemo(() => {
    const baseExtensions: Extension[] = [
      json(),
      EditorView.lineWrapping,
      // The editable element is what assistive tech focuses, so it carries
      // the name; on the wrapper it names nothing.
      ...(ariaLabel
        ? [EditorView.contentAttributes.of({ "aria-label": ariaLabel })]
        : []),
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
    if (extraExtensions) {
      baseExtensions.push(...extraExtensions);
    }
    return baseExtensions;
  }, [ariaLabel, jsonSchema, shouldLint, extraExtensions]);

  return (
    <CodeMirror
      value={props.value}
      extensions={extensions}
      editable
      theme={codeMirrorTheme}
      basicSetup={{
        ...(basicSetup as object),
        defaultKeymap: false,
      }}
      {...restProps}
    />
  );
}
