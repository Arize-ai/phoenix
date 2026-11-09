import {
  getNewExampleTemplate,
  type NewExampleTemplate,
} from "@phoenix/pages/examples/newExampleTemplate";
import type { EditableExampleRow } from "@phoenix/pages/examples/SaveDatasetExamplesDialog";
import type { EditableTableDiff } from "@phoenix/types/table";
import { isStringKeyedObject } from "@phoenix/typeUtils";
import { generateUUID } from "@phoenix/utils/uuidUtils";

import type { ExpectedOutputExample } from "../evaluatorCells";
import {
  ANNOTATIONS_KEY,
  getDisplayedMetadata,
  type MetadataDisplayOptions,
} from "../exampleColumns";

/**
 * A dataset example as the playground table edits it. `metadata` is the
 * metadata as the metadata column shows it, which may leave the
 * `annotations` key out; `hiddenMetadata` keeps what was left out so a save
 * can put it back.
 */
export type PlaygroundEditableExampleRow = EditableExampleRow & {
  hiddenMetadata: Record<string, unknown> | null;
  isNew: boolean;
};

/**
 * A row of the playground's dataset table: the editable example plus what
 * the evaluator cells read from it. A new example has no revision and no
 * expected outputs until it is saved.
 */
export type PlaygroundExampleTableRow = PlaygroundEditableExampleRow & {
  revisionId: string;
  expectedOutputs: ExpectedOutputExample["expectedOutputs"];
};

/**
 * What a new example starts from: the saved examples' shape with the values
 * cleared, minus the `annotations` key. That key holds expected outputs, and
 * a blank skeleton of one would read as an expected output of nothing.
 */
export function getNewPlaygroundExampleTemplate(
  rows: ReadonlyArray<
    Pick<PlaygroundExampleTableRow, "input" | "output" | "metadata" | "isNew">
  >
): NewExampleTemplate {
  return getNewExampleTemplate(
    rows.map((row) => ({
      ...row,
      metadata: toEditableMetadata(row.metadata, { hideAnnotations: true })
        .metadata,
    }))
  );
}

/** A new example to add: the template's blanks under a fresh local id. */
export function createNewPlaygroundExampleRow(
  template: NewExampleTemplate
): PlaygroundExampleTableRow {
  return {
    id: `new-${generateUUID()}`,
    externalId: null,
    ...template,
    hiddenMetadata: null,
    isNew: true,
    revisionId: "",
    expectedOutputs: [],
  };
}

/**
 * The editable view of an example: its metadata as displayed, with the
 * hidden `annotations` kept aside. The expected outputs live under that key,
 * so editing the stripped metadata must not drop them.
 */
export function toEditableMetadata(
  metadata: unknown,
  options: MetadataDisplayOptions
): Pick<PlaygroundEditableExampleRow, "metadata" | "hiddenMetadata"> {
  const displayed = getDisplayedMetadata(metadata, options);
  const value = isStringKeyedObject(displayed.value) ? displayed.value : {};

  if (!displayed.isHidingAnnotations || !isStringKeyedObject(metadata)) {
    return { metadata: value, hiddenMetadata: null };
  }

  return {
    metadata: value,
    hiddenMetadata: { [ANNOTATIONS_KEY]: metadata[ANNOTATIONS_KEY] },
  };
}

/**
 * Puts the hidden metadata back under every edited metadata value, so a
 * `replace METADATA` carries the example's annotations through. An edit that
 * sets the key itself wins over what was hidden.
 */
export function restoreHiddenMetadata<Row extends PlaygroundEditableExampleRow>(
  diff: EditableTableDiff<Row>,
  rowsById: ReadonlyMap<string, Row>
): EditableTableDiff<Row> {
  return {
    ...diff,
    updatedRows: diff.updatedRows.map(({ rowId, changes }) => {
      const hidden = rowsById.get(rowId)?.hiddenMetadata;

      if (changes.metadata === undefined || !hidden) {
        return { rowId, changes };
      }

      return {
        rowId,
        changes: {
          ...changes,
          metadata: {
            ...hidden,
            ...(isStringKeyedObject(changes.metadata) ? changes.metadata : {}),
          },
        },
      };
    }),
  };
}
