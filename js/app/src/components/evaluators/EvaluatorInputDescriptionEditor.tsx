import { css } from "@emotion/react";
import { FocusScope } from "react-aria";
import { Button as AriaButton } from "react-aria-components";

import {
  Button,
  Dialog,
  DialogTrigger,
  Flex,
  Label,
  Popover,
  PopoverArrow,
  Text,
  TextArea,
  TextField,
  View,
} from "@phoenix/components";

const DESCRIPTION_FIELD_NAME = "description";

const triggerCSS = css`
  font-size: var(--global-dimension-font-size-75);
  background: none;
  border: none;
  padding: 0;
  color: var(--global-link-color);
  cursor: pointer;
  &[data-hovered] {
    text-decoration: underline;
  }
  &[data-focus-visible] {
    outline: var(--global-border-size-thick) solid var(--global-color-primary);
    outline-offset: 2px;
  }
`;

/**
 * A "describe" link that opens a popover for writing what an evaluator input
 * should hold. Keeps the mapping form compact: the description is edited on
 * demand rather than in a field of its own on every row.
 */
export function EvaluatorInputDescriptionEditor({
  inputName,
  description,
  onSave,
}: {
  inputName: string;
  description: string;
  /** Receives the trimmed text; an empty string clears the description. */
  onSave: (description: string) => void;
}) {
  return (
    <DialogTrigger>
      <AriaButton
        type="button"
        className="evaluator-input-description__trigger"
        css={triggerCSS}
        aria-label={`${description ? "Edit" : "Add"} description for ${inputName}`}
      >
        describe
      </AriaButton>
      <Popover placement="bottom end">
        <PopoverArrow />
        <Dialog aria-label={`Description for ${inputName}`}>
          {({ close }) => (
            <FocusScope autoFocus contain restoreFocus>
              <View padding="size-100">
                <form
                  onSubmit={(event) => {
                    // The popover is portaled, but React still bubbles the
                    // submit to the evaluator form it was opened from.
                    event.preventDefault();
                    event.stopPropagation();
                    const value = new FormData(event.currentTarget).get(
                      DESCRIPTION_FIELD_NAME
                    );
                    if (typeof value === "string") {
                      onSave(value.trim());
                    }
                    close();
                  }}
                >
                  <Flex direction="column" gap="size-100">
                    <TextField
                      name={DESCRIPTION_FIELD_NAME}
                      defaultValue={description}
                      css={css`
                        min-width: 320px;
                      `}
                    >
                      <Label>Description</Label>
                      <TextArea rows={3} />
                      <Text slot="description">
                        What {inputName} should hold, to help map it.
                      </Text>
                    </TextField>
                    <Button type="submit" variant="primary" size="S">
                      Save
                    </Button>
                  </Flex>
                </form>
              </View>
            </FocusScope>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
