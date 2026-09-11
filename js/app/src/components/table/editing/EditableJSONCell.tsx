import { css } from "@emotion/react";
import type { CellContext } from "@tanstack/react-table";
import { useState } from "react";
import { Button as UnstyledButton } from "react-aria-components";
import { useHotkeys } from "react-hotkeys-hook";

import {
  Alert,
  Button,
  Dialog,
  Icon,
  Icons,
  KeyboardToken,
  Modal,
  ModalOverlay,
  Text,
  View,
  VisuallyHidden,
} from "@phoenix/components";
import { JSONEditor } from "@phoenix/components/code/JSONEditor";
import { JSONText } from "@phoenix/components/code/JSONText";
import {
  DialogCloseButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import { truncateSingleCSS } from "@phoenix/components/core/utility/Truncate";
import { useModifierKey } from "@phoenix/hooks/useModifierKey";
import { isPlainObject, safelyParseJSON } from "@phoenix/utils/jsonUtils";

import {
  formatJSONEditorValue,
  getJSONEditorInitialCursor,
} from "./jsonEditorValue";
import { useEditableTableCell } from "./useEditableTableCell";

// Fills the entire <td> so the cell itself is the click target and the
// edit affordance (hover background, dirty marker) can be drawn at the cell level.
const cellTriggerCSS = css`
  appearance: none;
  background: transparent;
  border: none;
  outline: none;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  margin: 0;
  padding: var(--global-table-cell-padding-y) var(--global-table-cell-padding-x);
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: text;
  min-width: 0;

  &[data-disabled] {
    cursor: default;
  }
`;

// Full-bleed editor: flush against the dialog header and footer so the
// modal reads as a single editing surface.
const editorContainerCSS = css`
  .cm-editor {
    background: transparent;
  }
  .cm-content {
    padding: var(--global-dimension-size-100) 0;
  }
`;

const footerHintCSS = css`
  margin-right: auto;
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-75);
`;

// The nearest block box around the text draws the ellipsis. The trigger
// button is a flex container, so the text's own span clamps it to one line.
const cellTextCSS = css`
  display: block;
  width: 100%;
  ${truncateSingleCSS};
  font-family: var(--global-font-family-mono);
`;

export type EditableJSONCellProps<
  Row extends object,
  ColumnId extends keyof Row & string,
> = CellContext<Row, unknown> & {
  columnId: ColumnId;
  requireObject?: boolean;
  title?: string;
  /**
   * Names the row this cell belongs to, for the trigger's accessible name.
   * Defaults to the row's ID, which is often opaque — pass something a person
   * would recognize.
   */
  rowLabel?: string;
};

/**
 * Compact JSON in read mode and a modal JSON editor in edit mode.
 * CodeMirror is loaded and mounted only while this cell is active.
 */
export function EditableJSONCell<
  Row extends object,
  ColumnId extends keyof Row & string,
>(props: EditableJSONCellProps<Row, ColumnId>) {
  const {
    columnId,
    requireObject = false,
    title: titleProp,
    rowLabel,
    ...cellContext
  } = props;
  // The default is assigned outside the destructuring pattern: a template
  // literal there is not compilable by the React Compiler.
  const title = titleProp ?? `Edit ${columnId}`;
  const cell = useEditableTableCell({
    context: cellContext as CellContext<Row, unknown>,
    columnId,
  });
  const [isOpen, setIsOpen] = useState(false);
  const [editorValue, setEditorValue] = useState("");
  // Read once when the editor mounts, so it only ever places the opening cursor.
  const [editorSelection, setEditorSelection] = useState({ anchor: 0 });
  const [editorError, setEditorError] = useState<string | null>(null);
  const modifierKey = useModifierKey();

  const validateEditorValue = (value: string) => {
    const result = safelyParseJSON(value);
    if (result.parseError) {
      return { error: "Enter valid JSON before saving this cell." };
    }
    if (requireObject && !isPlainObject(result.json)) {
      return { error: "This cell must contain a JSON object." };
    }
    return { error: null, json: result.json };
  };

  const openEditor = () => {
    const text = formatJSONEditorValue(cell.value);
    setEditorValue(text);
    setEditorSelection({ anchor: getJSONEditorInitialCursor(text) });
    setEditorError(validateEditorValue(text).error);
    setIsOpen(true);
  };

  const saveEditorValue = () => {
    const { error, json } = validateEditorValue(editorValue);
    setEditorError(error);
    if (error !== null) {
      return;
    }
    cell.updateValue(json as Row[ColumnId]);
    setIsOpen(false);
  };

  // Something to undo: a pending change already applied to the cell, or text
  // typed in the editor that has not been applied yet. The original value is
  // only serialized while the editor is open.
  const canUndo =
    cell.canRevert ||
    (isOpen && editorValue !== formatJSONEditorValue(cell.originalValue));

  // Restores the original value in both the store and the open editor.
  const undoEditorChange = () => {
    if (cell.canRevert) {
      cell.revertValue();
    }
    const text = formatJSONEditorValue(cell.originalValue);
    setEditorValue(text);
    setEditorError(validateEditorValue(text).error);
  };

  // Cmd+Enter commits the cell. Scoped to this cell's open dialog — every other
  // mounted cell keeps its shortcut disabled.
  useHotkeys("mod+enter", () => saveEditorValue(), {
    enabled: isOpen,
    enableOnFormTags: true,
    enableOnContentEditable: true,
    preventDefault: true,
  });

  if (!cell.isEditing || !cell.isEditable) {
    return (
      <span css={cellTextCSS}>
        <JSONText json={cell.value} maxLength={100} />
      </span>
    );
  }

  return (
    <>
      <UnstyledButton
        data-cell-edit-trigger
        data-dirty={cell.isDirty}
        css={cellTriggerCSS}
        isDisabled={cell.isSaving}
        onClick={(event) => event.stopPropagation()}
        onPress={openEditor}
        // Built from the column, not the dialog title: the title already carries
        // the row's context ("Edit input · new example"), and reusing it here
        // would announce that context twice.
        aria-label={`Edit ${columnId} for ${rowLabel ?? `row ${cellContext.row.id}`}`}
      >
        <span css={cellTextCSS}>
          {/* Show the full object while editing: a single-key object collapsed
              to its value reads as an empty cell once that value is blank. */}
          <JSONText
            json={cell.value}
            maxLength={100}
            collapseSingleKey={false}
          />
        </span>
      </UnstyledButton>
      <ModalOverlay
        isOpen={isOpen}
        onOpenChange={(nextIsOpen) => {
          if (!nextIsOpen) {
            setEditorError(null);
          }
          setIsOpen(nextIsOpen);
        }}
        isDismissable
      >
        <Modal size="L">
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton />
                </DialogTitleExtra>
              </DialogHeader>
              {editorError ? (
                <View paddingX="size-200" paddingTop="size-100">
                  <Alert variant="danger" banner>
                    {editorError}
                  </Alert>
                </View>
              ) : null}
              <div css={editorContainerCSS}>
                <JSONEditor
                  value={editorValue}
                  selection={editorSelection}
                  autoFocus
                  minHeight="240px"
                  maxHeight="60vh"
                  onChange={(nextValue) => {
                    setEditorValue(nextValue);
                    setEditorError(validateEditorValue(nextValue).error);
                  }}
                />
              </div>
              <DialogFooter>
                <span css={footerHintCSS}>
                  <KeyboardToken variant="quiet">
                    <VisuallyHidden>{modifierKey}</VisuallyHidden>
                    <span aria-hidden="true">
                      {modifierKey === "Cmd" ? "⌘" : "Ctrl"}
                    </span>{" "}
                    <VisuallyHidden>enter</VisuallyHidden>
                    <span aria-hidden="true">⏎</span>
                  </KeyboardToken>
                  <Text size="XS" color="text-500">
                    to apply
                  </Text>
                </span>
                <Button
                  variant="quiet"
                  isDisabled={!canUndo}
                  leadingVisual={<Icon svg={<Icons.RotateCcw />} />}
                  onPress={undoEditorChange}
                >
                  Undo
                </Button>
                <Button variant="default" slot="close">
                  Close
                </Button>
                <Button
                  variant="primary"
                  isDisabled={editorError !== null}
                  leadingVisual={<Icon svg={<Icons.Checkmark />} />}
                  onPress={saveEditorValue}
                >
                  Done
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </>
  );
}
