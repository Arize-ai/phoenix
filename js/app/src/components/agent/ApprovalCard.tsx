import { Flex } from "@phoenix/components";
import { assertUnreachable } from "@phoenix/typeUtils";

import { LazyToolPartDiffView } from "./LazyToolPartPierreViews";
import {
  ToolPartApprovalActions,
  ToolPartCodeBlock,
  ToolPartLabel,
} from "./ToolPartPrimitives";
import { stringifyToolValue } from "./toolPartTypes";

/**
 * How an approval's proposed change is shown for review:
 * - `diff`: a unified before/after, for operations that stage a snapshot
 *   change (prompt edits, prompt-tool writes, evaluator drafts);
 * - `json`: a curated payload object — only the fields the write actually
 *   sets, not the whole pending record;
 * - `text`: a one-line description when there is nothing structured to show.
 */
export type ApprovalPreviewBody =
  | { kind: "diff"; fileName: string; before: string; after: string }
  | { kind: "json"; payload: unknown }
  | { kind: "text"; text: string };

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
    case "json":
      return (
        <ToolPartCodeBlock>
          {stringifyToolValue(body.payload)}
        </ToolPartCodeBlock>
      );
    case "text":
      return <ToolPartCodeBlock>{body.text}</ToolPartCodeBlock>;
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
      <ApprovalPreviewBodyView body={preview.body} />
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
