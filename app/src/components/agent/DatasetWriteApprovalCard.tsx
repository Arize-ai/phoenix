import type { PendingDatasetWrite } from "@phoenix/agent/shared/pendingDatasetWrite";
import { Flex } from "@phoenix/components";
import { assertUnreachable } from "@phoenix/typeUtils";

import {
  ToolPartApprovalActions,
  ToolPartCodeBlock,
  ToolPartLabel,
} from "./ToolPartPrimitives";
import { stringifyToolValue } from "./toolPartTypes";

type PreviewDescriptor = {
  /** Short action label shown at the top of the card. */
  label: string;
  /** The JSON body rendered for review. */
  payload: unknown;
  /**
   * A permanence/scope warning for destructive (`delete-*`) kinds, or `null`.
   * Surfaces that label/split deletes are instance-wide (not a per-dataset
   * detach) and that deletes can't be undone, so the danger is visible at the
   * approval checkpoint rather than hidden behind a plain count.
   */
  note: string | null;
};

/**
 * Describe a pending write for the approval card: its action label, the JSON
 * payload to review, and (for destructive kinds) a permanence/scope warning.
 * One switch over the preview kind keeps each kind's label, body, and danger
 * note together, so adding a write kind touches a single place.
 */
function describePreview(pending: PendingDatasetWrite): PreviewDescriptor {
  const { preview } = pending;
  switch (preview.kind) {
    case "create":
      return {
        label: "Create dataset",
        payload: {
          name: preview.name,
          ...(preview.description != null
            ? { description: preview.description }
            : {}),
          ...(preview.examples?.length ? { examples: preview.examples } : {}),
        },
        note: null,
      };
    case "add":
      return {
        label: "Add examples",
        payload: { examples: preview.examples },
        note: null,
      };
    case "create-split":
      return {
        label: "Create split",
        payload: {
          name: preview.name,
          ...(preview.description != null
            ? { description: preview.description }
            : {}),
          color: preview.color,
          exampleCount: preview.exampleCount,
        },
        note: null,
      };
    case "set-splits":
      return {
        label: "Assign examples to splits",
        payload: {
          datasetName: preview.datasetName,
          splitNames: preview.splitNames,
          exampleIds: preview.exampleIds,
        },
        note: null,
      };
    case "create-label":
      return {
        label: "Create label",
        payload: {
          name: preview.name,
          ...(preview.description != null
            ? { description: preview.description }
            : {}),
          color: preview.color,
          attachToDataset: preview.attachToDataset,
        },
        note: null,
      };
    case "set-labels":
      return {
        label: "Set dataset labels",
        payload: { labelNames: preview.labelNames },
        note: null,
      };
    case "patch-dataset":
      return { label: "Edit dataset", payload: preview.changes, note: null };
    case "delete-dataset":
      return {
        label: "Delete dataset",
        payload: { datasetName: preview.datasetName },
        note: "Permanently deletes this dataset and all of its rows, split associations, and history. Cannot be undone.",
      };
    case "patch-examples":
      return {
        label: "Edit examples",
        payload: {
          datasetName: preview.datasetName,
          patches: preview.patches,
        },
        note: null,
      };
    case "delete-examples":
      return {
        label: "Delete examples",
        payload: {
          datasetName: preview.datasetName,
          exampleIds: preview.exampleIds,
        },
        note: "Removes these rows from the dataset (recorded as a new version).",
      };
    case "patch-split":
      return {
        label: "Edit split",
        payload: { splitName: preview.splitName, changes: preview.changes },
        note: null,
      };
    case "delete-splits":
      return {
        label: "Delete splits",
        payload: { splitNames: preview.splitNames },
        note: "Deletes these splits across the whole instance. Cannot be undone.",
      };
    case "delete-labels":
      return {
        label: "Delete labels",
        payload: { labelNames: preview.labelNames },
        note: "Deletes these labels across the whole instance, detaching them from every dataset. Cannot be undone.",
      };
    case "add-spans":
      return {
        label: "Add span(s) to dataset",
        payload: {
          datasetName: preview.datasetName,
          spanCount: preview.spanCount,
        },
        note: null,
      };
    default:
      return assertUnreachable(preview);
  }
}

/**
 * Inline Accept/Reject card for a dataset write awaiting approval in manual
 * edit mode. Shared by every dataset write tool's details.
 */
export function DatasetWriteApprovalCard({
  pending,
}: {
  pending: PendingDatasetWrite;
}) {
  const canRespond = Boolean(pending.accept && pending.reject);
  const { label, payload, note } = describePreview(pending);
  return (
    <Flex direction="column" gap="size-100" minHeight="0">
      <ToolPartLabel variant={note ? "danger" : undefined}>
        {label}
      </ToolPartLabel>
      <ToolPartCodeBlock>{stringifyToolValue(payload)}</ToolPartCodeBlock>
      {note ? <ToolPartLabel variant="danger">{note}</ToolPartLabel> : null}
      <ToolPartApprovalActions
        onAccept={() => void pending.accept?.()}
        onReject={() => void pending.reject?.()}
        isDisabled={!canRespond}
        staleMessage="This proposal was made in an earlier session and can't be applied here. Re-run your request to have the assistant propose it again."
      />
    </Flex>
  );
}
