import type { ToolProgressState } from "./toolProgress";

/**
 * Derives the display elements for one tool call — a terminal-safe icon, a
 * one-line preview of what the tool is doing, and a few detail/error lines —
 * from the tool's (possibly still-streaming) input and output. This mirrors
 * the web UI's per-tool presentation registry in
 * `app/src/components/agent/ToolPart.tsx`, which cannot be imported from this
 * package.
 *
 * Everything here is pure string derivation so it stays cheap: the whole
 * transcript re-renders on every stream snapshot, so presenters only read
 * named fields and clamp raw text before splitting — tool payloads are never
 * stringified or scanned in full.
 */

/** Display-ready description of one tool call, derived from its input/output. */
export type ToolPresentation = {
  /** Terminal-safe glyph identifying the tool (single-width BMP unicode). */
  icon: string;
  /** One-line summary of what the tool is doing; empty until derivable. */
  previewText: string;
  /** Dimmed lines shown under the header, e.g. the bash command excerpt. */
  detailLines: string[];
  /** Red lines shown under the details, e.g. a stderr or error excerpt. */
  errorLines: string[];
  /** Short annotation appended to the header, e.g. `exit 1`. */
  statusSuffix?: string;
  /** Whether the completed call collapses to a single dim line. */
  isQuiet: boolean;
  /** The text of the collapsed quiet line, e.g. `Loaded skill datasets`. */
  quietLabel?: string;
};

type ToolPresenterOptions = {
  state: ToolProgressState;
  input: unknown;
  output: unknown;
  errorText?: string;
};

type ToolPresenter = (
  options: ToolPresenterOptions
) => Partial<ToolPresentation>;

const GENERIC_TOOL_ICON = "◆";

/** Cap on how much of a raw payload string is ever inspected. */
const MAX_SOURCE_LENGTH = 1000;
const PREVIEW_MAX_LENGTH = 120;
const DETAIL_LINE_MAX_LENGTH = 200;
const COMMAND_DETAIL_MAX_LINES = 3;
const STDERR_MAX_LINES = 2;
const ERROR_TEXT_MAX_LINES = 3;

/**
 * Input fields checked, in priority order, when deriving a generic preview
 * for tools without a bespoke presenter.
 */
const GENERIC_PREVIEW_FIELDS = [
  "summary",
  "description",
  "query",
  "name",
  "path",
  "url",
  "prompt",
  "text",
  "command",
];

/** How many input entries the generic fallback scans for any string value. */
const GENERIC_SCAN_LIMIT = 20;

/** Known field aliases for the target URL of provider-native web tools. */
const NATIVE_WEB_URL_FIELDS = ["url", "uri", "href"];

/** Known field aliases for the search text of provider-native web search. */
const NATIVE_WEB_SEARCH_QUERY_FIELDS = ["query", "q", "search_query"];

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getStringField({
  record,
  field,
}: {
  record: Record<string, unknown>;
  field: string;
}): string {
  const value = record[field];
  return typeof value === "string" ? value : "";
}

function getFirstStringField({
  record,
  fields,
}: {
  record: Record<string, unknown>;
  fields: readonly string[];
}): string {
  for (const field of fields) {
    const value = getStringField({ record, field });
    if (value) {
      return value;
    }
  }
  return "";
}

/**
 * Collapse text to a single width-clamped line: whitespace runs (including
 * newlines) become single spaces, and overlong text is cut with an ellipsis.
 */
function toSingleLine({
  text,
  maxLength = PREVIEW_MAX_LENGTH,
}: {
  text: string;
  maxLength?: number;
}): string {
  const collapsed = text
    .slice(0, MAX_SOURCE_LENGTH)
    .replace(/\s+/g, " ")
    .trim();
  return collapsed.length > maxLength
    ? `${collapsed.slice(0, maxLength)}…`
    : collapsed;
}

/**
 * Split text into at most `maxLines` display lines, clamping each line's
 * length and appending a `… (+N more lines)` sentinel when lines were cut.
 */
export function getClampedLines({
  text,
  maxLines,
}: {
  text: string;
  maxLines: number;
}): string[] {
  const truncatedSource = text.length > MAX_SOURCE_LENGTH;
  const allLines = text
    .slice(0, MAX_SOURCE_LENGTH)
    .split("\n")
    .filter((line) => line.trim().length > 0);
  const visibleLines = allLines
    .slice(0, maxLines)
    .map((line) =>
      line.length > DETAIL_LINE_MAX_LENGTH
        ? `${line.slice(0, DETAIL_LINE_MAX_LENGTH)}…`
        : line
    );
  const hiddenLineCount = allLines.length - visibleLines.length;
  if (hiddenLineCount > 0) {
    visibleLines.push(
      `… (+${hiddenLineCount} more ${hiddenLineCount === 1 ? "line" : "lines"})`
    );
  } else if (truncatedSource && visibleLines.length > 0) {
    visibleLines.push("…");
  }
  return visibleLines;
}

/**
 * Generic preview for tools without a bespoke presenter: a string input is
 * used directly; a record input yields its first known preview field, else the
 * first string value among its leading entries.
 */
function getGenericToolPreview({ input }: { input: unknown }): string {
  if (typeof input === "string") {
    return toSingleLine({ text: input });
  }
  const record = asRecord(input);
  if (!record) {
    return "";
  }
  const fieldValue = getFirstStringField({
    record,
    fields: GENERIC_PREVIEW_FIELDS,
  });
  if (fieldValue) {
    return toSingleLine({ text: fieldValue });
  }
  for (const value of Object.values(record).slice(0, GENERIC_SCAN_LIMIT)) {
    if (typeof value === "string" && value.trim().length > 0) {
      return toSingleLine({ text: value });
    }
  }
  return "";
}

/**
 * Bash presenter. The preview prefers the model-written `summary`, which
 * streams in before `command`, so a description shows while the command is
 * still arriving; the detail lines are an excerpt of the command itself. On
 * completion, a non-zero exit code surfaces as a status suffix plus a stderr
 * excerpt.
 */
function getBashPresentation({
  state,
  input,
  output,
}: ToolPresenterOptions): Partial<ToolPresentation> {
  const inputRecord = asRecord(input);
  const summary = inputRecord
    ? getStringField({ record: inputRecord, field: "summary" })
    : "";
  const command = inputRecord
    ? getStringField({ record: inputRecord, field: "command" })
    : "";
  const presentation: Partial<ToolPresentation> = {
    icon: "$",
    previewText: toSingleLine({ text: summary || command.split("\n")[0] }),
    detailLines: command
      ? getClampedLines({ text: command, maxLines: COMMAND_DETAIL_MAX_LINES })
      : [],
  };
  const outputRecord = state === "output-available" ? asRecord(output) : null;
  if (outputRecord) {
    const exitCode = outputRecord.exit_code;
    if (typeof exitCode === "number" && exitCode !== 0) {
      presentation.statusSuffix = `exit ${exitCode}`;
      const stderr = getStringField({ record: outputRecord, field: "stderr" });
      presentation.errorLines = stderr
        ? getClampedLines({ text: stderr, maxLines: STDERR_MAX_LINES })
        : [];
    }
  }
  return presentation;
}

/**
 * Provider-native web search: prefer the query text; typed non-search actions
 * (e.g. page reads) show a humanized action label with their target.
 */
function getWebSearchPresentation({
  input,
}: ToolPresenterOptions): Partial<ToolPresentation> {
  const presentation: Partial<ToolPresentation> = { icon: "⌕" };
  const record = asRecord(input);
  if (typeof input === "string") {
    presentation.previewText = toSingleLine({ text: input });
    return presentation;
  }
  if (!record) {
    return presentation;
  }
  const type = getStringField({ record, field: "type" });
  if (type && type !== "search") {
    const value =
      getFirstStringField({ record, fields: NATIVE_WEB_URL_FIELDS }) ||
      getFirstStringField({ record, fields: NATIVE_WEB_SEARCH_QUERY_FIELDS });
    const label = type
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
    presentation.previewText = toSingleLine({
      text: value ? `${label}: ${value}` : label,
    });
    return presentation;
  }
  const query = getFirstStringField({
    record,
    fields: NATIVE_WEB_SEARCH_QUERY_FIELDS,
  });
  if (query) {
    presentation.previewText = toSingleLine({ text: query });
    return presentation;
  }
  const queries = record.queries;
  if (Array.isArray(queries)) {
    const firstQuery = queries.find(
      (value): value is string => typeof value === "string" && value.length > 0
    );
    if (firstQuery) {
      presentation.previewText = toSingleLine({ text: firstQuery });
    }
  }
  return presentation;
}

function getWebFetchPresentation({
  input,
}: ToolPresenterOptions): Partial<ToolPresentation> {
  const record = asRecord(input);
  return {
    icon: "↓",
    previewText: record
      ? toSingleLine({
          text: getFirstStringField({ record, fields: NATIVE_WEB_URL_FIELDS }),
        })
      : "",
  };
}

function getCallSubagentPresentation({
  input,
}: ToolPresenterOptions): Partial<ToolPresentation> {
  const record = asRecord(input);
  return {
    icon: "◇",
    previewText: record
      ? toSingleLine({ text: getStringField({ record, field: "name" }) })
      : "",
  };
}

/**
 * Skill loads are routine bookkeeping: once complete they collapse to a
 * single dim `Loaded skill <name>` line instead of a full tool row.
 */
function getLoadSkillPresentation({
  state,
  input,
}: ToolPresenterOptions): Partial<ToolPresentation> {
  const record = asRecord(input);
  const skillName = record
    ? getStringField({ record, field: "skill_name" })
    : "";
  const presentation: Partial<ToolPresentation> = {
    icon: "✦",
    previewText: toSingleLine({ text: skillName }),
  };
  if (state === "output-available") {
    presentation.isQuiet = true;
    presentation.quietLabel = skillName
      ? `Loaded skill ${toSingleLine({ text: skillName })}`
      : "Loaded skill";
  }
  return presentation;
}

/**
 * Skill resource reads are routine bookkeeping, like skill loads: once
 * complete they collapse to a single dim `Read skill resource
 * <skill>/<resource>` line instead of a full tool row.
 */
function getReadSkillResourcePresentation({
  state,
  input,
}: ToolPresenterOptions): Partial<ToolPresentation> {
  const record = asRecord(input);
  const skillName = record
    ? getStringField({ record, field: "skill_name" })
    : "";
  const resourceName = record
    ? getStringField({ record, field: "resource_name" })
    : "";
  const resourceLabel = toSingleLine({
    text: [skillName, resourceName].filter(Boolean).join("/"),
  });
  const presentation: Partial<ToolPresentation> = {
    icon: "✦",
    previewText: resourceLabel,
  };
  if (state === "output-available") {
    presentation.isQuiet = true;
    presentation.quietLabel = resourceLabel
      ? `Read skill resource ${resourceLabel}`
      : "Read skill resource";
  }
  return presentation;
}

const TOOL_PRESENTERS: Record<string, ToolPresenter> = {
  bash: getBashPresentation,
  web_search: getWebSearchPresentation,
  web_fetch: getWebFetchPresentation,
  call_subagent: getCallSubagentPresentation,
  load_skill: getLoadSkillPresentation,
  read_skill_resource: getReadSkillResourcePresentation,
};

/**
 * Build the {@link ToolPresentation} for a tool call: the bespoke presenter
 * for known tools, else the generic first-string-field preview. Error text
 * from the part is folded into `errorLines` when the presenter didn't already
 * produce a more specific excerpt (e.g. bash stderr).
 */
export function getToolPresentation({
  toolName,
  state,
  input,
  output,
  errorText,
}: ToolPresenterOptions & { toolName: string }): ToolPresentation {
  const presenter = TOOL_PRESENTERS[toolName];
  const presentation: ToolPresentation = {
    icon: GENERIC_TOOL_ICON,
    previewText: "",
    detailLines: [],
    errorLines: [],
    isQuiet: false,
    ...(presenter
      ? presenter({ state, input, output, errorText })
      : { previewText: getGenericToolPreview({ input }) }),
  };
  if (presentation.errorLines.length === 0 && errorText) {
    presentation.errorLines = getClampedLines({
      text: errorText,
      maxLines: ERROR_TEXT_MAX_LINES,
    });
  }
  return presentation;
}
