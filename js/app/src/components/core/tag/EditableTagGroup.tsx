import { css } from "@emotion/react";
import type { FormEvent, ReactNode } from "react";
import { Suspense, useEffect, useRef, useState } from "react";
import { DialogTrigger, FormContext } from "react-aria-components";

import { Alert } from "@phoenix/components/core/alert";
import { IconButton } from "@phoenix/components/core/button";
import { Text } from "@phoenix/components/core/content";
import { Dialog } from "@phoenix/components/core/dialog";
import { Icon, Icons } from "@phoenix/components/core/icon";
import { Loading } from "@phoenix/components/core/loading";
import { Popover, PopoverArrow } from "@phoenix/components/core/overlay";

import type { TagGroupItem } from "./TagGroup";
import { TagGroup } from "./TagGroup";

export interface EditableTagGroupProps {
  /**
   * Names the set for assistive technology, such as "Dataset labels".
   */
  "aria-label": string;
  /**
   * The tags attached now, in the order they show.
   */
  items: readonly TagGroupItem[];
  /**
   * What one tag is, in the singular ("label"). It names the add control
   * ("Add label") and the empty state ("No labels").
   * @default "label"
   */
  noun?: string;
  /**
   * Detaches tags: the remove buttons, and Delete or Backspace on the focused
   * tag. Leave it and `picker` out where the person cannot edit the set.
   */
  onRemove?: (ids: Set<string>) => void;
  /**
   * What the add control opens, usually a `TagPicker` wired to the domain's
   * options. It renders inside a popover and may suspend while it loads.
   */
  picker?: ReactNode;
  /**
   * Why the last change did not save. It shows at the top of the picker
   * while the picker is open, and under the tags otherwise.
   */
  error?: string | null;
}

const editableTagGroupCSS = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--global-dimension-size-50);
  min-width: 0;
`;

const errorUnderTagsCSS = css`
  flex-basis: 100%;
`;

// Bounded like a menu's container, so a long list scrolls inside the
// popover instead of running past it
const pickerContentCSS = css`
  display: flex;
  flex-direction: column;
  max-height: var(--global-menu-max-height-large);
`;

function stopSubmitPropagation(event: FormEvent) {
  event.stopPropagation();
}

/**
 * A set of tags a person edits in place, in a form or a page header. The set
 * is a removable `TagGroup`; beside it, an add control opens a picker of
 * everything that can be attached. It holds no data of its own: the caller
 * passes the items, removes them, and supplies the picker, so the same group
 * persists every change at once in a header and only on submit in a form.
 *
 * When the last tag is removed from the keyboard, focus moves to the add
 * control rather than being lost with the tag.
 */
export function EditableTagGroup({
  "aria-label": label,
  items,
  noun = "label",
  onRemove,
  picker,
  error,
}: EditableTagGroupProps) {
  const groupRef = useRef<HTMLDivElement>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const shouldFocusAddRef = useRef(false);
  const isEmpty = items.length === 0;

  useEffect(() => {
    if (isEmpty && shouldFocusAddRef.current) {
      shouldFocusAddRef.current = false;
      groupRef.current
        ?.querySelector<HTMLButtonElement>(":scope > button")
        ?.focus();
    }
  }, [isEmpty]);

  const handleRemove = onRemove
    ? (ids: Set<string>) => {
        const isRemovingAll = items.every((item) => ids.has(item.id));
        const hasFocus =
          groupRef.current?.contains(document.activeElement) ?? false;
        shouldFocusAddRef.current = isRemovingAll && hasFocus;
        onRemove(ids);
      }
    : undefined;

  return (
    // The group keeps the set's name when it is empty and the tag list,
    // which carries it otherwise, is gone
    <div
      ref={groupRef}
      role="group"
      aria-label={label}
      className="editable-tag-group"
      css={editableTagGroupCSS}
    >
      {isEmpty ? (
        <Text size="S" color="text-500">
          {`No ${noun}s`}
        </Text>
      ) : (
        <TagGroup aria-label={label} items={items} onRemove={handleRemove} />
      )}
      {picker ? (
        <DialogTrigger isOpen={isPickerOpen} onOpenChange={setIsPickerOpen}>
          <IconButton size="S" aria-label={`Add ${noun}`}>
            <Icon svg={<Icons.Plus />} />
          </IconButton>
          <Popover
            placement="bottom start"
            shouldCloseOnInteractOutside={() => true}
          >
            <PopoverArrow />
            <Dialog aria-label={label}>
              {/* A group placed inside a form must never submit it from the
                  picker's own forms (such as its create form). A Form passes
                  its props, onSubmit included, to any Form beneath it through
                  FormContext, and React bubbles a submit up the component
                  tree even out of a portal, so both stop here. */}
              <FormContext.Provider value={null}>
                <div css={pickerContentCSS} onSubmit={stopSubmitPropagation}>
                  {error ? <Alert variant="danger">{error}</Alert> : null}
                  <Suspense fallback={<Loading />}>{picker}</Suspense>
                </div>
              </FormContext.Provider>
            </Dialog>
          </Popover>
        </DialogTrigger>
      ) : null}
      {error && !isPickerOpen ? (
        <div css={errorUnderTagsCSS}>
          <Alert variant="danger">{error}</Alert>
        </div>
      ) : null}
    </div>
  );
}
