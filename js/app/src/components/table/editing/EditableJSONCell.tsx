import { css } from "@emotion/react";
import type { CellContext } from "@tanstack/react-table";
import { useState } from "react";

import {
  Alert,
  Button,
  Dialog,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
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
import { isPlainObject, safelyParseJSON } from "@phoenix/utils/jsonUtils";

import { useEditableTableCell } from "./useEditableTableCell";

const editableJSONCellCSS = css`
  width: 100%;
  min-width: 0;
  justify-content: flex-start;
  text-align: left;
  font-family: var(--global-font-family-mono);
  font-weight: normal;

  &[data-dirty="true"] {
    background-color: rgba(var(--global-color-warning-rgb), 0.12);
    border-color: var(--global-color-warning);
  }
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

  if (!cell.isEditing || !cell.isEditable) {
    return <JSONText json={cell.value} maxLength={100} />;
  }

  const validateEditorValue = (value: string) => {
    const result = safelyParseJSON(value);
    if (result.parseError) {
      return "Enter valid JSON before saving this cell.";
    }
    if (requireObject && !isPlainObject(result.json)) {
      return "This cell must contain a JSON object.";
    }
    return null;
  };

  const openEditor = () => {
    setEditorValue(JSON.stringify(cell.value, null, 2) ?? "");
    setEditorError(null);
    cell.setError(null);
    setIsOpen(true);
  };

  const saveEditorValue = () => {
    const error = validateEditorValue(editorValue);
    setEditorError(error);
    cell.setError(error);
    if (error !== null) {
      return;
    }
    const result = safelyParseJSON(editorValue);
    cell.updateValue(result.json as Row[ColumnId]);
    setIsOpen(false);
  };

  return (
    <>
      <Button
        data-dirty={cell.isDirty}
        variant="quiet"
        size="S"
        css={editableJSONCellCSS}
        isDisabled={cell.isSaving}
        onClick={(event) => event.stopPropagation()}
        onPress={openEditor}
        aria-label={`${title} for row ${cellContext.row.id}`}
      >
        <JSONText json={cell.value} maxLength={100} />
      </Button>
      <ModalOverlay
        isOpen={isOpen}
        onOpenChange={(nextIsOpen) => {
          if (!nextIsOpen) {
            setEditorError(null);
            cell.setError(null);
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
              <View padding="size-200">
                <JSONEditor
                  value={editorValue}
                  height="400px"
                  onChange={(nextValue) => {
                    setEditorValue(nextValue);
                    const error = validateEditorValue(nextValue);
                    setEditorError(error);
                    cell.setError(error);
                  }}
                />
              </View>
              <DialogFooter>
                <Button variant="default" slot="close">
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  isDisabled={editorError !== null}
                  leadingVisual={<Icon svg={<Icons.Save />} />}
                  onPress={saveEditorValue}
                >
                  Save cell
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </>
  );
}
