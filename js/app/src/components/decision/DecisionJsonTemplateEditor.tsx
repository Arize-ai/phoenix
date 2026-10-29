import type { ReactCodeMirrorProps } from "@uiw/react-codemirror";
import { useEffect, useRef, useState } from "react";

import {
  JSONEditor,
  pierreTemplateVariableColor,
} from "@phoenix/components/code";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import { useTheme } from "@phoenix/contexts";

import { decisionJsonTemplateHighlighting } from "./decisionJsonTemplateExtensions";

type DecisionJsonTemplateEditorProps = Pick<
  ReactCodeMirrorProps,
  "onCreateEditor" | "onUpdate" | "onBlur" | "placeholder" | "height"
> & {
  /** The template as first shown; remount (with `key`) to show another. */
  defaultValue: string;
  templateFormat: TemplateFormat;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  "aria-label"?: string;
};

/**
 * A JSON editor for a decision's JSON state template: the JSON is linted,
 * and the variable tags in its strings are highlighted under the template
 * format, a string that is exactly one tag drawn as a typed hole.
 *
 * Uncontrolled, like the template editor: what is typed stays the value so
 * the cursor stays put; remount it to show another template.
 */
export function DecisionJsonTemplateEditor({
  defaultValue,
  templateFormat,
  onChange,
  readOnly = false,
  "aria-label": ariaLabel = "JSON state template",
  ...props
}: DecisionJsonTemplateEditorProps) {
  const [value, setValue] = useState(defaultValue);
  // A stable handler: react-codemirror reconfigures the editor whenever
  // `onChange` changes.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  const { theme } = useTheme();
  const extensions = decisionJsonTemplateHighlighting({
    templateFormat,
    variableColor: pierreTemplateVariableColor[theme],
  });
  return (
    <JSONEditor
      {...props}
      aria-label={ariaLabel}
      value={readOnly ? defaultValue : value}
      readOnly={readOnly}
      optionalLint
      extensions={extensions}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
      }}
      onChange={(next) => {
        setValue(next);
        onChangeRef.current?.(next);
      }}
    />
  );
}
