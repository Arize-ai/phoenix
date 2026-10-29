/**
 * The decision rendering rules, as the server applies them
 * (`src/phoenix/server/decisions/rendering.py`): a saved decision is the
 * request it sends, with holes in it, and rendering fills the holes.
 *
 * 1. A variable of the decision missing from `variables` is an error naming
 *    it; extra variables are ignored.
 * 2. A text template renders with the template format. A structured value
 *    renders as JSON (as Python's `json.dumps(value, ensure_ascii=False)`
 *    writes it), and Mustache dotted paths and sections read into structured
 *    values.
 * 3. A JSON template is walked; object keys are literal. A string leaf that
 *    is exactly one variable tag becomes the value it names, JSON type kept;
 *    any other string leaf renders by rule 2. Numbers, booleans and null pass
 *    through.
 * 4. `NONE` substitutes nothing.
 * 5. The state must come out as non-empty text, an object, or a list.
 * 6. Each templated question field renders by rule 2; instructions cannot
 *    render empty.
 *
 * Mustache templates are parsed with mustache.js, as the template editors
 * parse them, and rendered here with pystache's lookup rules; F-String
 * templates follow Python's `str.format`. The shared vectors in
 * `tests/fixtures/decisions/rendering_cases.json` pin both.
 */
import Mustache from "mustache";

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

/** The state a call sends: text, an object, or a list. */
export type RenderedDecisionState =
  | string
  | Record<string, unknown>
  | unknown[];

export type RenderedDecision = {
  state: RenderedDecisionState;
  questions: DecisionQuestionTemplate[];
};

/** A template that can't be parsed, a missing variable, or a state a provider won't take. */
export class DecisionRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecisionRenderError";
  }
}

/** A Python-style error raised while formatting, with Python's message. */
class FormatError extends Error {}

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// JSON as Python writes it
// ---------------------------------------------------------------------------

/**
 * A number as Python's `repr` writes it. Integers are written whole;
 * other floats use Python's exponent form below 1e-4 (`1e-05`).
 */
function toPythonNumberText(value: number): string {
  if (Number.isInteger(value)) {
    return Math.abs(value) < 1e16 ? String(value) : toPythonExponent(value);
  }
  return Math.abs(value) < 1e-4 ? toPythonExponent(value) : String(value);
}

function toPythonExponent(value: number): string {
  const [mantissa, exponent] = value.toExponential().split("e");
  const sign = exponent.startsWith("-") ? "-" : "+";
  const digits = exponent.replace(/^[+-]/, "").padStart(2, "0");
  return `${mantissa}e${sign}${digits}`;
}

/**
 * A JSON value as Python's `json.dumps(value, ensure_ascii=False)` writes
 * it: `", "` and `": "` separators, non-ASCII characters kept.
 */
export function toPythonJsonText(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return toPythonNumberText(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => toPythonJsonText(item)).join(", ")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value).map(
      ([key, item]) => `${JSON.stringify(key)}: ${toPythonJsonText(item)}`
    );
    return `{${entries.join(", ")}}`;
  }
  return JSON.stringify(String(value));
}

/** Python truthiness for a JSON value: null, false, 0, "", [] and {} are false. */
function isPythonTruthy(value: unknown): boolean {
  if (value === null || value === undefined || value === false) return false;
  if (value === 0 || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (isJsonObject(value)) return Object.keys(value).length > 0;
  return true;
}

/** Python's `repr` of a string, for `!r` and error messages. */
function toPythonStringRepr(text: string, { isAscii = false } = {}): string {
  const quote = text.includes("'") && !text.includes('"') ? '"' : "'";
  let result = quote;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (char === quote || char === "\\") result += `\\${char}`;
    else if (char === "\n") result += "\\n";
    else if (char === "\r") result += "\\r";
    else if (char === "\t") result += "\\t";
    else if (code < 0x20 || (code >= 0x7f && code <= 0xa0) || code === 0xad) {
      result += `\\x${code.toString(16).padStart(2, "0")}`;
    } else if (isAscii && code > 0x7f) {
      result +=
        code <= 0xff
          ? `\\x${code.toString(16).padStart(2, "0")}`
          : code <= 0xffff
            ? `\\u${code.toString(16).padStart(4, "0")}`
            : `\\U${code.toString(16).padStart(8, "0")}`;
    } else result += char;
  }
  return result + quote;
}

// ---------------------------------------------------------------------------
// Mustache, with pystache's lookups
// ---------------------------------------------------------------------------

type MustacheToken = ReturnType<typeof Mustache.parse>[number];

const NOT_FOUND = Symbol("not found");

function parseMustache({
  template,
  location,
}: {
  template: string;
  location: string;
}): MustacheToken[] {
  try {
    return Mustache.parse(template);
  } catch (error) {
    throw new DecisionRenderError(
      `Invalid template in ${location}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * A name read from the context stack as pystache reads it: `.` is the top
 * of the stack; a dotted name finds its first part in the nearest object
 * that has it, then walks object fields only.
 */
function lookupMustacheName({
  stack,
  name,
}: {
  stack: readonly unknown[];
  name: string;
}): unknown {
  if (name === ".") {
    return stack.length > 0 ? stack[stack.length - 1] : NOT_FOUND;
  }
  const [first, ...rest] = name.split(".");
  let value: unknown = NOT_FOUND;
  for (let index = stack.length - 1; index >= 0; index--) {
    const frame = stack[index];
    if (isJsonObject(frame) && Object.hasOwn(frame, first)) {
      value = frame[first];
      break;
    }
  }
  for (const part of rest) {
    if (value === NOT_FOUND) break;
    value =
      isJsonObject(value) && Object.hasOwn(value, part)
        ? value[part]
        : NOT_FOUND;
  }
  return value;
}

/** A value as a Mustache tag writes it: text as-is, anything else as JSON, a miss as nothing. */
function toMustacheText(value: unknown): string {
  if (value === NOT_FOUND) return "";
  return typeof value === "string" ? value : toPythonJsonText(value);
}

function renderMustacheTokens({
  tokens,
  stack,
}: {
  tokens: readonly MustacheToken[];
  stack: unknown[];
}): string {
  let result = "";
  for (const token of tokens) {
    const [type, value] = token;
    switch (type) {
      case "text":
        result += value;
        break;
      case "name":
      case "&":
        result += toMustacheText(lookupMustacheName({ stack, name: value }));
        break;
      case "#": {
        const data = lookupMustacheName({ stack, name: value });
        if (data === NOT_FOUND || !isPythonTruthy(data)) break;
        const children = (token[4] ?? []) as MustacheToken[];
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          stack.push(item);
          result += renderMustacheTokens({ tokens: children, stack });
          stack.pop();
        }
        break;
      }
      case "^": {
        const data = lookupMustacheName({ stack, name: value });
        if (data !== NOT_FOUND && isPythonTruthy(data)) break;
        const children = (token[4] ?? []) as MustacheToken[];
        result += renderMustacheTokens({ tokens: children, stack });
        break;
      }
      default:
        // Comments, delimiter changes and partials render nothing.
        break;
    }
  }
  return result;
}

const MUSTACHE_VARIABLE_TOKEN_TYPES = new Set(["#", "^", "name", "&"]);

function getMustacheVariableNames({
  template,
  location,
}: {
  template: string;
  location: string;
}): string[] {
  const names: string[] = [];
  for (const [type, key] of parseMustache({ template, location })) {
    if (!MUSTACHE_VARIABLE_TOKEN_TYPES.has(type)) continue;
    if (typeof key === "string" && key && key !== ".") {
      names.push(key.split(".")[0]);
    }
  }
  return names;
}

// ---------------------------------------------------------------------------
// F-String, as Python's str.format
// ---------------------------------------------------------------------------

type FormatField = {
  fieldName: string;
  conversion: string | null;
  formatSpec: string;
};

type FormatPart = { literal: string; field: FormatField | null };

/** Python's `string.Formatter().parse`: literal text and replacement fields. */
function parsePythonFormat(template: string): FormatPart[] {
  const parts: FormatPart[] = [];
  let literal = "";
  let index = 0;
  while (index < template.length) {
    const char = template[index];
    if (char !== "{" && char !== "}") {
      literal += char;
      index += 1;
      continue;
    }
    const next = template[index + 1];
    if (next === char) {
      literal += char;
      index += 2;
      continue;
    }
    if (char === "}") {
      throw new FormatError("Single '}' encountered in format string");
    }
    if (next === undefined) {
      throw new FormatError("Single '{' encountered in format string");
    }
    // A replacement field runs to its matching brace.
    let depth = 1;
    let end = index + 1;
    while (end < template.length) {
      const current = template[end];
      if (current === "{") depth += 1;
      else if (current === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
      end += 1;
    }
    if (depth !== 0) {
      throw new FormatError("expected '}' before end of string");
    }
    parts.push({
      literal,
      field: parseFormatField(template.slice(index + 1, end)),
    });
    literal = "";
    index = end + 1;
  }
  if (literal) parts.push({ literal, field: null });
  return parts;
}

/** The name, conversion and spec of one field, as CPython's `parse_field` splits them. */
function parseFormatField(content: string): FormatField {
  let index = 0;
  let terminator: string | null = null;
  while (index < content.length) {
    const char = content[index];
    index += 1;
    if (char === "{") {
      throw new FormatError("unexpected '{' in field name");
    }
    if (char === "[") {
      while (index < content.length && content[index] !== "]") index += 1;
      continue;
    }
    if (char === ":" || char === "!") {
      terminator = char;
      break;
    }
  }
  if (terminator == null) {
    return { fieldName: content, conversion: null, formatSpec: "" };
  }
  const fieldName = content.slice(0, index - 1);
  if (terminator === ":") {
    return { fieldName, conversion: null, formatSpec: content.slice(index) };
  }
  if (index >= content.length) {
    throw new FormatError(
      "end of string while looking for conversion specifier"
    );
  }
  const conversion = content[index];
  index += 1;
  if (index < content.length) {
    if (content[index] !== ":") {
      throw new FormatError("expected ':' after conversion specifier");
    }
    index += 1;
  }
  return { fieldName, conversion, formatSpec: content.slice(index) };
}

function getFStringVariableNames({
  template,
  location,
}: {
  template: string;
  location: string;
}): string[] {
  let parts: FormatPart[];
  try {
    parts = parsePythonFormat(template);
  } catch (error) {
    throw new DecisionRenderError(
      `Invalid template in ${location}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  return parts.flatMap(({ field }) => {
    if (!field?.fieldName) return [];
    const match = field.fieldName.match(/^[^.[]+/);
    return [match ? match[0] : field.fieldName];
  });
}

const FIELD_PART_PATTERN = /\.([^.[\]]+)|\[([^[\]]+)\]/g;

/** The value a field name reads: JSON object fields and list items only. */
function getFStringField({
  fieldName,
  values,
}: {
  fieldName: string;
  values: JsonObject;
}): unknown {
  const first = fieldName.match(/^[^.[\]]*/)?.[0] ?? "";
  if (!Object.hasOwn(values, first)) {
    throw new FormatError(first);
  }
  let value: unknown = values[first];
  for (const match of fieldName
    .slice(first.length)
    .matchAll(FIELD_PART_PATTERN)) {
    const [, attribute, index] = match;
    if (attribute) {
      if (
        attribute.startsWith("_") ||
        !isJsonObject(value) ||
        !Object.hasOwn(value, attribute)
      ) {
        throw new FormatError(
          `JSON value has no attribute ${toPythonStringRepr(attribute)}`
        );
      }
      value = value[attribute];
    } else if (isJsonObject(value)) {
      if (!Object.hasOwn(value, index)) {
        throw new FormatError(`no item ${toPythonStringRepr(index)}`);
      }
      value = value[index];
    } else if (Array.isArray(value)) {
      const position = /^\s*[+-]?\d+(_\d+)*\s*$/.test(index)
        ? Number(index.replaceAll("_", ""))
        : Number.NaN;
      const resolved = position < 0 ? value.length + position : position;
      if (
        !Number.isInteger(resolved) ||
        resolved < 0 ||
        resolved >= value.length
      ) {
        const key = /^\d+$/.test(index.replace(/^-+/, ""))
          ? String(Number.parseInt(index, 10))
          : toPythonStringRepr(index);
        throw new FormatError(`no item ${key}`);
      }
      value = value[resolved];
    } else {
      throw new FormatError("JSON scalar is not subscriptable");
    }
  }
  return value;
}

const FORMAT_SPEC_PATTERN =
  /^(?:(.)?([<>=^]))?([+\- ])?(#)?(0)?(\d+)?([,_])?(?:\.(\d+))?([a-zA-Z%])?$/;

type FormatSpec = {
  fill: string;
  align: string | null;
  sign: string | null;
  width: number;
  grouping: string | null;
  precision: number | null;
  type: string;
};

function parseFormatSpec(spec: string): FormatSpec {
  const match = spec.match(FORMAT_SPEC_PATTERN);
  if (!match) throw new FormatError(`Invalid format specifier '${spec}'`);
  const [, fill, align, sign, , zero, width, grouping, precision, type] = match;
  return {
    fill: fill ?? (zero && !align ? "0" : " "),
    // A leading zero pads numbers after the sign, as `=` does.
    align: align ?? (zero ? "=" : null),
    sign: sign ?? null,
    width: width ? Number(width) : 0,
    grouping: grouping ?? null,
    precision: precision != null ? Number(precision) : null,
    type: type ?? "",
  };
}

function requireInteger({ value, type }: { value: number; type: string }) {
  if (!Number.isInteger(value)) {
    throw new FormatError(
      `Unknown format code '${type}' for object of type 'float'`
    );
  }
}

const RADIX_BY_FORMAT_TYPE: Partial<Record<string, number>> = {
  x: 16,
  X: 16,
  o: 8,
  b: 2,
};

/** A number's digits for a format type, without its sign. */
function formatNumberDigits({
  magnitude,
  value,
  spec,
}: {
  magnitude: number;
  value: number;
  spec: FormatSpec;
}): string {
  const { type, precision } = spec;
  const radix = RADIX_BY_FORMAT_TYPE[type];
  if (radix != null) {
    requireInteger({ value, type });
    const digits = magnitude.toString(radix);
    return type === "X" ? digits.toUpperCase() : digits;
  }
  switch (type) {
    case "":
      return precision != null
        ? String(Number(magnitude.toPrecision(precision)))
        : toPythonNumberText(magnitude);
    case "d":
      requireInteger({ value, type });
      return String(magnitude);
    case "f":
    case "F":
      return magnitude.toFixed(precision ?? 6);
    case "e":
    case "E": {
      const [mantissa, exponent] = toPythonExponent(
        Number(magnitude.toExponential(precision ?? 6))
      ).split("e");
      const digits = `${Number(mantissa).toFixed(precision ?? 6)}e${exponent}`;
      return type === "E" ? digits.toUpperCase() : digits;
    }
    case "%":
      return `${(magnitude * 100).toFixed(precision ?? 6)}%`;
    default:
      throw new FormatError(
        `The format spec '${type}' can't be previewed; run it to see the result`
      );
  }
}

function formatNumber({ value, spec }: { value: number; spec: FormatSpec }): {
  sign: string;
  digits: string;
} {
  let digits = formatNumberDigits({ magnitude: Math.abs(value), value, spec });
  if (spec.grouping) {
    const [whole, fraction] = digits.split(".");
    digits =
      whole.replace(/\B(?=(\d{3})+(?!\d))/g, spec.grouping) +
      (fraction != null ? `.${fraction}` : "");
  }
  const isNegative = value < 0 || Object.is(value, -0);
  const sign = isNegative
    ? "-"
    : spec.sign === "+" || spec.sign === " "
      ? spec.sign
      : "";
  return { sign, digits };
}

function padFormatted({
  body,
  spec,
  defaultAlign,
}: {
  body: string;
  spec: FormatSpec;
  defaultAlign: string;
}): string {
  const padding = Math.max(0, spec.width - [...body].length);
  switch (spec.align ?? defaultAlign) {
    case "<":
      return body + spec.fill.repeat(padding);
    case "^": {
      const left = Math.floor(padding / 2);
      return spec.fill.repeat(left) + body + spec.fill.repeat(padding - left);
    }
    default:
      return spec.fill.repeat(padding) + body;
  }
}

/**
 * Python's `format(value, spec)` for text and numbers, covering fill,
 * alignment, sign, width, grouping, precision and the s, d, f, e, %, x, o
 * and b types. Other specs can't be previewed here.
 */
function applyFormatSpec({
  value,
  spec: specText,
}: {
  value: string | number;
  spec: string;
}): string {
  if (!specText) {
    return typeof value === "number" ? toPythonNumberText(value) : value;
  }
  const spec = parseFormatSpec(specText);
  if (typeof value === "string") {
    if (spec.type && spec.type !== "s") {
      throw new FormatError(
        `Unknown format code '${spec.type}' for object of type 'str'`
      );
    }
    const body =
      spec.precision != null
        ? [...value].slice(0, spec.precision).join("")
        : value;
    return padFormatted({ body, spec, defaultAlign: "<" });
  }
  const { sign, digits } = formatNumber({ value, spec });
  if (spec.align === "=") {
    const padding = Math.max(0, spec.width - sign.length - digits.length);
    return sign + spec.fill.repeat(padding) + digits;
  }
  return padFormatted({ body: sign + digits, spec, defaultAlign: ">" });
}

/** Python's `format_field`, as the server's formatter overrides it. */
function formatFStringValue({
  value,
  spec,
}: {
  value: unknown;
  spec: string;
}): string {
  if (typeof value === "number") return applyFormatSpec({ value, spec });
  const text = typeof value === "string" ? value : toPythonJsonText(value);
  return applyFormatSpec({ value: text, spec });
}

function convertFStringValue({
  value,
  conversion,
}: {
  value: unknown;
  conversion: string | null;
}): unknown {
  if (conversion == null) return value;
  const text =
    typeof value === "string" ? value : formatFStringValue({ value, spec: "" });
  switch (conversion) {
    case "r":
      return typeof value === "string" ? toPythonStringRepr(value) : text;
    case "s":
      return text;
    case "a":
      return toPythonStringRepr(text, { isAscii: true });
    default:
      throw new FormatError(`Unknown conversion specifier ${conversion}`);
  }
}

function renderFString({
  template,
  values,
  depth = 2,
}: {
  template: string;
  values: JsonObject;
  depth?: number;
}): string {
  if (depth < 0) throw new FormatError("Max string recursion exceeded");
  let result = "";
  let autoIndex: number | false = 0;
  for (const { literal, field } of parsePythonFormat(template)) {
    result += literal;
    if (!field) continue;
    let { fieldName } = field;
    if (fieldName === "") {
      if (autoIndex === false) {
        throw new FormatError(
          "cannot switch from manual field specification to automatic field numbering"
        );
      }
      fieldName = String(autoIndex);
      autoIndex += 1;
    } else if (/^\d+$/.test(fieldName)) {
      if (autoIndex) {
        throw new FormatError(
          "cannot switch from automatic field numbering to manual field specification"
        );
      }
      autoIndex = false;
    }
    const value = convertFStringValue({
      value: getFStringField({ fieldName, values }),
      conversion: field.conversion,
    });
    const spec = renderFString({
      template: field.formatSpec,
      values,
      depth: depth - 1,
    });
    result += formatFStringValue({ value, spec });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Variables
// ---------------------------------------------------------------------------

/**
 * The root variable names in one template, in order of appearance, with
 * repeats. A dotted path such as `{{customer.tier}}` names `customer`; names
 * inside a Mustache section are read from the section's value.
 *
 * Throws a {@link DecisionRenderError} when the template can't be parsed.
 */
export function getTemplateVariableNames({
  templateFormat,
  template,
  location = "the template",
}: {
  templateFormat: TemplateFormat;
  template: string;
  /** Where the template is, for the error message. */
  location?: string;
}): string[] {
  switch (templateFormat) {
    case TemplateFormats.NONE:
      return [];
    case TemplateFormats.Mustache:
      return getMustacheVariableNames({ template, location });
    case TemplateFormats.FString:
      return getFStringVariableNames({ template, location });
    default:
      return assertUnreachable(templateFormat);
  }
}

function* getStringLeaves(value: unknown): Generator<string> {
  if (typeof value === "string") {
    yield value;
  } else if (Array.isArray(value)) {
    for (const item of value) yield* getStringLeaves(item);
  } else if (isJsonObject(value)) {
    for (const item of Object.values(value)) yield* getStringLeaves(item);
  }
}

function* getQuestionFields(
  question: DecisionQuestionTemplate
): Generator<[location: string, text: string | null | undefined]> {
  yield [`the instructions of ${question.name}`, question.instructions];
  switch (question.type) {
    case "predicate":
      if (question.criteria != null) {
        yield [
          `the true criterion of ${question.name}`,
          question.criteria.true,
        ];
        yield [
          `the false criterion of ${question.name}`,
          question.criteria.false,
        ];
      }
      break;
    case "choice":
      for (const option of question.choices) {
        yield [
          `choice ${toPythonStringRepr(option.value)} of ${question.name}`,
          option.description,
        ];
      }
      break;
    case "scale":
      for (const level of question.levels) {
        yield [
          `level ${toPythonStringRepr(level.label)} of ${question.name}`,
          level.description,
        ];
      }
      break;
    default:
      assertUnreachable(question);
  }
}

function* getDecisionTemplates({
  state,
  questions,
}: {
  state: DecisionStateTemplate;
  questions: readonly DecisionQuestionTemplate[];
}): Generator<[location: string, template: string]> {
  if (state.type === "text") {
    yield ["the state", state.template];
  } else {
    for (const leaf of getStringLeaves(state.template)) {
      yield ["the state", leaf];
    }
  }
  for (const question of questions) {
    for (const [location, text] of getQuestionFields(question)) {
      if (typeof text === "string") yield [location, text];
    }
  }
}

/**
 * The variables a decision's templates use, by root name, in
 * first-appearance order: the state first, then each question's fields.
 *
 * Throws a {@link DecisionRenderError} when a template can't be parsed.
 */
export function getDecisionVariables({
  templateFormat,
  state,
  questions,
}: {
  templateFormat: TemplateFormat;
  state: DecisionStateTemplate;
  questions: readonly DecisionQuestionTemplate[];
}): string[] {
  const names = new Set<string>();
  for (const [location, template] of getDecisionTemplates({
    state,
    questions,
  })) {
    for (const name of getTemplateVariableNames({
      templateFormat,
      template,
      location,
    })) {
      names.add(name);
    }
  }
  return [...names];
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const MUSTACHE_WHOLE_TAG = /^\{\{\s*([^\s{}#^/!>&=.][^\s{}]*)\s*\}\}$/;
const F_STRING_WHOLE_TAG = /^\{([^{}!:]+)\}$/;

/**
 * The path a string names when it is exactly one variable tag, such as
 * `{{ customer.tier }}` or `{items[0]}`; null for any other string. In a
 * JSON template such a string is a typed hole: it becomes the value itself.
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

/** A text template filled with the variables, as rule 2 renders it. */
export function renderTextTemplate({
  templateFormat,
  template,
  variables,
  location = "the template",
}: {
  templateFormat: TemplateFormat;
  template: string;
  variables: JsonObject;
  location?: string;
}): string {
  if (templateFormat === TemplateFormats.NONE) return template;
  if (templateFormat === TemplateFormats.Mustache) {
    const tokens = parseMustache({ template, location });
    return renderMustacheTokens({ tokens, stack: [variables] });
  }
  try {
    return renderFString({ template, values: variables });
  } catch (error) {
    if (!(error instanceof FormatError)) throw error;
    const isParseError =
      /encountered in format string|before end of string|in field name|conversion specifier/.test(
        error.message
      ) && !error.message.startsWith("Unknown conversion");
    throw new DecisionRenderError(
      isParseError
        ? `Invalid template in ${location}: ${error.message}`
        : `Can't render ${location}: ${error.message}`
    );
  }
}

/** The value a whole tag names, JSON type kept. */
function resolveWholeTag({
  templateFormat,
  path,
  variables,
}: {
  templateFormat: TemplateFormat;
  path: string;
  variables: JsonObject;
}): unknown {
  if (templateFormat === TemplateFormats.FString) {
    try {
      return getFStringField({ fieldName: path, values: variables });
    } catch (error) {
      if (!(error instanceof FormatError)) throw error;
      throw new DecisionRenderError(`The state reads a missing field: ${path}`);
    }
  }
  const [root, ...parts] = path.split(".");
  let value: unknown = variables[root];
  for (const part of parts) {
    if (!isJsonObject(value) || !Object.hasOwn(value, part)) {
      throw new DecisionRenderError(`The state reads a missing field: ${path}`);
    }
    value = value[part];
  }
  return value;
}

function renderJsonTemplate({
  templateFormat,
  value,
  variables,
}: {
  templateFormat: TemplateFormat;
  value: unknown;
  variables: JsonObject;
}): unknown {
  if (templateFormat === TemplateFormats.NONE) return value;
  if (Array.isArray(value)) {
    return value.map((item) =>
      renderJsonTemplate({ templateFormat, value: item, variables })
    );
  }
  if (isJsonObject(value)) {
    // fromEntries defines own properties, so a `__proto__` key stays a key.
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        renderJsonTemplate({ templateFormat, value: item, variables }),
      ])
    );
  }
  if (typeof value === "string") {
    const path = getWholeTagPath({ templateFormat, text: value });
    if (path != null) {
      return resolveWholeTag({ templateFormat, path, variables });
    }
    return renderTextTemplate({
      templateFormat,
      template: value,
      variables,
      location: "the state",
    });
  }
  return value;
}

function renderQuestion({
  templateFormat,
  question,
  variables,
}: {
  templateFormat: TemplateFormat;
  question: DecisionQuestionTemplate;
  variables: JsonObject;
}): DecisionQuestionTemplate {
  const render = (text: string | null | undefined, location: string) =>
    typeof text === "string"
      ? renderTextTemplate({
          templateFormat,
          template: text,
          variables,
          location,
        })
      : text;
  const instructions = renderTextTemplate({
    templateFormat,
    template: question.instructions,
    variables,
    location: `the instructions of ${question.name}`,
  });
  if (!instructions.trim()) {
    throw new DecisionRenderError(
      `Instructions for ${question.name} cannot be empty`
    );
  }
  switch (question.type) {
    case "predicate": {
      if (question.criteria == null) return { ...question, instructions };
      // Only fields with text are touched, so the copy reads like the original.
      const criteria = { ...question.criteria };
      if (typeof criteria.true === "string") {
        criteria.true = render(
          criteria.true,
          `the true criterion of ${question.name}`
        );
      }
      if (typeof criteria.false === "string") {
        criteria.false = render(
          criteria.false,
          `the false criterion of ${question.name}`
        );
      }
      return { ...question, instructions, criteria };
    }
    case "choice":
      return {
        ...question,
        instructions,
        choices: question.choices.map((option) =>
          typeof option.description === "string"
            ? {
                ...option,
                description: render(
                  option.description,
                  `choice ${toPythonStringRepr(option.value)} of ${question.name}`
                ),
              }
            : option
        ),
      };
    case "scale":
      return {
        ...question,
        instructions,
        levels: question.levels.map((level) =>
          typeof level.description === "string"
            ? {
                ...level,
                description: render(
                  level.description,
                  `level ${toPythonStringRepr(level.label)} of ${question.name}`
                ),
              }
            : level
        ),
      };
    default:
      return assertUnreachable(question);
  }
}

/**
 * Fill a decision's templates with a call's variables: the state and
 * questions the call sends.
 *
 * Throws a {@link DecisionRenderError} when a template is invalid, a
 * variable is missing, a whole-tag path reads a missing field, or the state
 * or an instruction renders to something a provider won't take.
 */
export function renderDecision({
  templateFormat,
  state,
  questions,
  variables,
}: {
  templateFormat: TemplateFormat;
  state: DecisionStateTemplate;
  questions: readonly DecisionQuestionTemplate[];
  /** A value for each variable, keyed by name; any JSON. */
  variables: Readonly<JsonObject>;
}): RenderedDecision {
  const names = getDecisionVariables({ templateFormat, state, questions });
  const missing = names.filter((name) => !Object.hasOwn(variables, name));
  if (missing.length > 0) {
    throw new DecisionRenderError(`Missing variables: ${missing.join(", ")}`);
  }
  const values = { ...variables };
  const renderedState =
    state.type === "text"
      ? renderTextTemplate({
          templateFormat,
          template: state.template,
          variables: values,
          location: "the state",
        })
      : renderJsonTemplate({
          templateFormat,
          value: state.template,
          variables: values,
        });
  if (
    typeof renderedState !== "string" &&
    (typeof renderedState !== "object" || renderedState === null)
  ) {
    throw new DecisionRenderError(
      "State must be text, a JSON object, or a list"
    );
  }
  if (typeof renderedState === "string" && !renderedState.trim()) {
    throw new DecisionRenderError("State cannot be empty");
  }
  return {
    state: renderedState as RenderedDecisionState,
    questions: questions.map((question) =>
      renderQuestion({ templateFormat, question, variables: values })
    ),
  };
}
