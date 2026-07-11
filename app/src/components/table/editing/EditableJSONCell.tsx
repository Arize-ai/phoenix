import { css } from "@emotion/react";
import type { CellContext } from "@tanstack/react-table";
import { useState } from "react";
import { Button as UnstyledButton } from "react-aria-components";

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
import { useModifierKey } from "@phoenix/hooks/useModifierKey";
import { isPlainObject, safelyParseJSON } from "@phoenix/utils/jsonUtils";

import { useEditableTableCell } from "./useEditableTableCell";

// Fills the entire <td> so the cell itself is the click target and the
// edit affordance (hover ring, dirty marker) can be drawn at the cell level.
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
  padding: var(--global-table-cell-padding-y)
    var(--global-table-cell-padding-x);
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

// Single-line truncation keeps every row at the virtualizer's fixed height.
const cellTextCSS = css`
  display: block;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--global-font-family-mono);
`;

export type EditableJSONCellProps<
  Row extends object,
  ColumnId extends keyof Row & string,
> = CellContext<Row, unknown> & {
  columnId: ColumnId;
  requireObject?: boolean;
  title?: string;
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
    title = `Edit ${columnId}`,
    ...cellContext
  } = props;
  const cell = useEditableTableCell({
    context: cellContext as CellContext<Row, unknown>,
    columnId,
  });
  const [isOpen, setIsOpen] = useState(false);
  const [editorValue, setEditorValue] = useState("");
  const [editorError, setEditorError] = useState<string | null>(null);
  const modifierKey = useModifierKey();

  if (!cell.isEditing || !cell.isEditable) {
    return (
      <span css={cellTextCSS}>
        <JSONText json={cell.value} maxLength={100} />
      </span>
    );
  }

  // Set the local (banner) and cell-level (store) errors together so the
  // dialog and the table stay in sync.
  const applyEditorError = (error: string | null) => {
    setEditorError(error);
    cell.setError(error);
  };

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
    setEditorValue(JSON.stringify(cell.value, null, 2) ?? "");
    applyEditorError(null);
    setIsOpen(true);
  };

  const saveEditorValue = () => {
    const { error, json } = validateEditorValue(editorValue);
    applyEditorError(error);
    if (error !== null) {
      return;
    }
    cell.updateValue(json as Row[ColumnId]);
    setIsOpen(false);
  };

  return (
    <>
      <UnstyledButton
        data-cell-edit-trigger
        data-dirty={cell.isDirty}
        css={cellTriggerCSS}
        isDisabled={cell.isSaving}
        onClick={(event) => event.stopPropagation()}
        onPress={openEditor}
        aria-label={`${title} for row ${cellContext.row.id}`}
      >
        <span css={cellTextCSS}>
          <JSONText json={cell.value} maxLength={100} />
        </span>
      </UnstyledButton>
      <ModalOverlay
        isOpen={isOpen}
        onOpenChange={(nextIsOpen) => {
          if (!nextIsOpen) {
            applyEditorError(null);
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
              <div
                css={editorContainerCSS}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    (event.metaKey || event.ctrlKey)
                  ) {
                    event.preventDefault();
                    saveEditorValue();
                  }
                }}
              >
                <JSONEditor
                  value={editorValue}
                  autoFocus
                  minHeight="240px"
                  maxHeight="60vh"
                  onChange={(nextValue) => {
                    setEditorValue(nextValue);
                    applyEditorError(validateEditorValue(nextValue).error);
                  }}
                />
              </div>
              <DialogFooter>
                <span css={footerHintCSS}>
                  <KeyboardToken variant="quiet">
                    {modifierKey === "Cmd" ? "⌘" : "Ctrl"} ↵
                  </KeyboardToken>
                  <Text size="XS" color="text-500">
                    to save
                  </Text>
                </span>
                <Button variant="default" slot="close">
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  isDisabled={editorError !== null}
                  leadingVisual={<Icon svg={<Icons.Save />} />}
                  onPress={saveEditorValue}
                >
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </>
  );
}
