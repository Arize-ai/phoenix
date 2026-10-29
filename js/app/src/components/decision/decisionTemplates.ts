/**
 * A decision's templates as stored: a state that is a text or a JSON
 * template, and questions whose prose fields are templates. The server
 * renders them (`src/phoenix/server/decisions/rendering.py`).
 */
import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import { assertUnreachable } from "@phoenix/typeUtils";

/** A decision's state template, as stored. */
export type DecisionStateTemplate =
  | { type: "text"; template: string }
  | { type: "json"; template: unknown };

/** A question as stored; only its prose fields are templates. */
export type DecisionQuestionTemplate =
  | {
      type: "predicate";
      name: string;
      instructions: string;
      criteria?: { true?: string | null; false?: string | null } | null;
    }
  | {
      type: "choice";
      name: string;
      instructions: string;
      choices: ReadonlyArray<{ value: string; description?: string | null }>;
    }
  | {
      type: "scale";
      name: string;
      instructions: string;
      levels: ReadonlyArray<{ label: string; description?: string | null }>;
    };

const MUSTACHE_WHOLE_TAG = /^\{\{\s*([^\s{}#^/!>&=.][^\s{}]*)\s*\}\}$/;
const F_STRING_WHOLE_TAG = /^\{([^{}!:]+)\}$/;

/**
 * The path a string names when it is exactly one variable tag, such as
 * `{{ customer.tier }}` or `{items[0]}`; null for any other string. In a
 * JSON template such a string becomes the value itself, JSON type kept.
 */
export function getWholeTagPath({
  templateFormat,
  text,
}: {
  templateFormat: TemplateFormat;
  text: string;
}): string | null {
  switch (templateFormat) {
    case TemplateFormats.NONE:
      return null;
    case TemplateFormats.Mustache:
      return text.match(MUSTACHE_WHOLE_TAG)?.[1] ?? null;
    case TemplateFormats.FString:
      return text.match(F_STRING_WHOLE_TAG)?.[1] ?? null;
    default:
      return assertUnreachable(templateFormat);
  }
}

/**
 * Whether a JSON state as written is one bare variable tag, `{{state}}`
 * without quotes: the whole state is that variable's value. It is stored as
 * the JSON string `"{{state}}"`, which reads the same.
 */
export function isBareWholeTag({
  templateFormat,
  json,
}: {
  templateFormat: TemplateFormat;
  json: string;
}): boolean {
  return getWholeTagPath({ templateFormat, text: json.trim() }) != null;
}

/**
 * A stored JSON state template as the JSON editor shows it: a state that is
 * one whole tag as the bare tag, `{{state}}`; anything else as JSON.
 */
export function toJsonTemplateText({
  template,
  templateFormat,
}: {
  template: unknown;
  templateFormat: TemplateFormat;
}): string {
  if (
    typeof template === "string" &&
    getWholeTagPath({ templateFormat, text: template }) != null
  ) {
    return template;
  }
  return JSON.stringify(template, null, 2);
}
