import type { ReactCodeMirrorProps } from "@uiw/react-codemirror";
import { useEffect, useRef, useState } from "react";

import {
  JSONEditor,
  pierreTemplateVariableColor,
} from "@phoenix/components/code";
import { createTemplateAutocomplete } from "@phoenix/components/templateEditor/autocomplete";
import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import { useTheme } from "@phoenix/contexts";

import { decisionJsonTemplateExtensions } from "./decisionJsonTemplateExtensions";

type DecisionJsonTemplateEditorProps = Pick<
  ReactCodeMirrorProps,
  "placeholder"
> & {
  /** The template as first shown; remount (with `key`) to show another. */
  defaultValue: string;
  templateFormat: TemplateFormat;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  /** Dataset paths a variable tag can autocomplete, as in the template editor. */
  availablePaths?: string[];
  "aria-label"?: string;
};

/**
 * A JSON editor for a decision's JSON state template: the JSON is linted,
 * and the variable tags in its strings are highlighted under the template
 * format. A state that is one bare tag, `{{state}}`, is the whole value.
 *
 * Uncontrolled, like the template editor: what is typed stays the value so
 * the cursor stays put; remount it to show another template.
 */
export function DecisionJsonTemplateEditor({
  defaultValue,
  templateFormat,
  onChange,
  readOnly = false,
  availablePaths,
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
  const extensions = [
    ...decisionJsonTemplateExtensions({
      templateFormat,
      variableColor: pierreTemplateVariableColor[theme],
    }),
    ...(!readOnly &&
    templateFormat !== TemplateFormats.NONE &&
    (availablePaths?.length ?? 0) > 0
      ? [createTemplateAutocomplete(availablePaths ?? [], templateFormat)]
      : []),
  ];
  return (
    <JSONEditor
      {...props}
      aria-label={ariaLabel}
      value={readOnly ? defaultValue : value}
      readOnly={readOnly}
      lint={false}
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
