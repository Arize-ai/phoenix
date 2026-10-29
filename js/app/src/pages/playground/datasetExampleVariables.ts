import { getValueAtPath } from "@phoenix/utils/objectUtils";

/** The fields of a dataset example a task's template variables come from. */
export type DatasetExampleFields = {
  input: unknown;
  output: unknown;
  metadata: unknown;
};

/**
 * The context a task's template variables resolve against, matching the
 * backend mapping: the example's `input` and `metadata`, and its output as
 * `reference`.
 */
export function toTemplateVariablesContext(example: DatasetExampleFields): {
  input: unknown;
  reference: unknown;
  metadata: unknown;
} {
  return {
    input: example.input,
    reference: example.output,
    metadata: example.metadata,
  };
}

/**
 * The variables one dataset example offers a task: its template variables
 * context scoped to the template variables path, or the whole context when
 * the path is empty.
 */
export function scopeExampleVariables({
  example,
  templateVariablesPath,
}: {
  example: DatasetExampleFields;
  templateVariablesPath: string | null | undefined;
}): unknown {
  const context = toTemplateVariablesContext(example);
  return templateVariablesPath
    ? getValueAtPath(context, templateVariablesPath)
    : context;
}
