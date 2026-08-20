import { Fragment } from "react";

import { Flex } from "@phoenix/components";
import { assertUnreachable } from "@phoenix/typeUtils";

import { LazyToolPartDiffView } from "./LazyToolPartPierreViews";
import {
  ToolPartApprovalActions,
  ToolPartExpandableSection,
  ToolPartLabel,
  ToolPartText,
} from "./ToolPartPrimitives";

/**
 * One labeled row of an approval summary. `value` is prose — possibly
 * multi-line for structured payloads, where each line is a `path: value`
 * pair — never raw JSON.
 */
export type ApprovalSummaryRow = {
  label: string;
  value: string;
};

/**
 * How an approval's proposed change is shown for review:
 * - `diff`: a unified before/after, for operations that stage a snapshot
 *   change (prompt edits, prompt-tool writes, evaluator drafts);
 * - `summary`: labeled key–value rows — only the fields the write actually
 *   sets, readable without knowing JSON;
 * - `text`: a one-line description when there is nothing structured to show.
 */
export type ApprovalPreviewBody =
  | { kind: "diff"; fileName: string; before: string; after: string }
  | { kind: "summary"; rows: ApprovalSummaryRow[] }
  | { kind: "text"; text: string };

/** Space out a camelCase payload key for row labels: "datasetName" → "dataset name". */
function humanizeKey(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPrimitive(value: unknown): value is string | number | boolean {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

/**
 * Flatten a structured value into `path: value` lines — the prose form of a
 * nested payload. Empty objects and arrays are dropped entirely (an
 * `annotations: {}` line is noise at an approval checkpoint), and primitive
 * arrays join inline rather than fanning out one line per element.
 */
function flattenToLines(value: unknown, path: string): string[] {
  if (value == null) {
    return [];
  }
  if (isPrimitive(value)) {
    return [`${path}: ${String(value)}`];
  }
  if (Array.isArray(value)) {
    if (value.every(isPrimitive)) {
      return value.length > 0 ? [`${path}: ${value.join(", ")}`] : [];
    }
    return value.flatMap((item, index) =>
      flattenToLines(item, `${path}[${index + 1}]`)
    );
  }
  if (isPlainObject(value)) {
    return Object.entries(value).flatMap(([key, child]) =>
      flattenToLines(child, path === "" ? key : `${path}.${key}`)
    );
  }
  const fallback = JSON.stringify(value) ?? String(value);
  return [path === "" ? fallback : `${path}: ${fallback}`];
}

/**
 * Convert a curated approval payload (only the fields the write sets) into
 * summary rows — all prose, never raw JSON:
 * - scalars and primitive arrays render inline;
 * - arrays of objects fan out one row per element ("examples 1", "examples
 *   2"), each a multi-line list of `path: value` pairs;
 * - nested objects flatten to dot-path pairs under their row label.
 */
export function payloadToApprovalSummaryRows(
  payload: Record<string, unknown>
): ApprovalSummaryRow[] {
  return Object.entries(payload).flatMap(
    ([key, value]): ApprovalSummaryRow[] => {
      const label = humanizeKey(key);
      if (isPrimitive(value)) {
        return [{ label, value: String(value) }];
      }
      if (Array.isArray(value)) {
        if (value.every(isPrimitive)) {
          return value.length > 0 ? [{ label, value: value.join(", ") }] : [];
        }
        return value.flatMap((item, index) => {
          const lines = flattenToLines(item, "");
          return lines.length > 0
            ? [{ label: `${label} ${index + 1}`, value: lines.join("\n") }]
            : [];
        });
      }
      const lines = flattenToLines(value, "");
      return lines.length > 0 ? [{ label, value: lines.join("\n") }] : [];
    }
  );
}

/**
 * The reviewable description of one pending approval, independent of where it
 * was staged (a standalone write tool or an inner `ui.*` call of an
 * `execute_ui` script). Producing this shape is the per-operation concern;
 * rendering it is {@link ApprovalCard}'s.
 */
export type ApprovalPreview = {
  /** Action label shown at the top of the card, e.g. "Delete dataset". */
  title: string;
  /**
   * A permanence/scope warning for destructive or wide-reaching changes, or
   * `null`. When set, the title and the note both render in the danger color
   * so the risk is visible at the approval checkpoint.
   */
  danger?: string | null;
  body: ApprovalPreviewBody;
};

function ApprovalPreviewBodyView({ body }: { body: ApprovalPreviewBody }) {
  switch (body.kind) {
    case "diff":
      return (
        <LazyToolPartDiffView
          fileName={body.fileName}
          before={body.before}
          after={body.after}
        />
      );
    case "summary":
      return (
        <div className="tool-part__line">
          <dl className="tool-part__kv">
            {body.rows.map((row, index) => (
              <Fragment key={index}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </Fragment>
            ))}
          </dl>
        </div>
      );
    case "text":
      return <ToolPartText>{body.text}</ToolPartText>;
    default:
      return assertUnreachable(body);
  }
}

/**
 * The one inline Accept/Reject card shared by every PXI approval — standalone
 * write tools (dataset writes, annotation-config writes, experiment patches)
 * and the inner-operation approvals an `execute_ui` script stages alike. Each
 * caller maps its pending state to an {@link ApprovalPreview}; this component
 * owns the label/diff/danger-note/actions layout so every approval reads the
 * same and gains structured previews instead of a raw JSON dump.
 */
export function ApprovalCard({
  preview,
  onAccept,
  onReject,
  isDisabled = false,
  staleMessage,
}: {
  preview: ApprovalPreview;
  onAccept: () => void;
  onReject: () => void;
  isDisabled?: boolean;
  staleMessage?: string;
}) {
  return (
    <Flex direction="column" gap="size-100" minHeight="0">
      <ToolPartLabel variant={preview.danger ? "danger" : undefined}>
        {preview.title}
      </ToolPartLabel>
      {/* Height-collapse tall bodies (a many-example dataset write, a long
          diff) so the Accept/Reject controls stay in reach — the user can
          expand to review everything before deciding. */}
      <ToolPartExpandableSection>
        <ApprovalPreviewBodyView body={preview.body} />
      </ToolPartExpandableSection>
      {preview.danger ? (
        <ToolPartLabel variant="danger">{preview.danger}</ToolPartLabel>
      ) : null}
      <ToolPartApprovalActions
        onAccept={onAccept}
        onReject={onReject}
        isDisabled={isDisabled}
        staleMessage={staleMessage}
      />
    </Flex>
  );
}
