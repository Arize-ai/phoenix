import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Suspense, useEffect, useRef } from "react";
import { DialogTrigger } from "react-aria-components";

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
}

const editableTagGroupCSS = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--global-dimension-size-50);
  min-width: 0;
`;

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
}: EditableTagGroupProps) {
  const groupRef = useRef<HTMLDivElement>(null);
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
    <div
      ref={groupRef}
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
        <DialogTrigger>
          <IconButton size="S" aria-label={`Add ${noun}`}>
            <Icon svg={<Icons.Plus />} />
          </IconButton>
          <Popover
            placement="bottom start"
            shouldCloseOnInteractOutside={() => true}
          >
            <PopoverArrow />
            <Dialog aria-label={label}>
              <Suspense fallback={<Loading />}>{picker}</Suspense>
            </Dialog>
          </Popover>
        </DialogTrigger>
      ) : null}
    </div>
  );
}
