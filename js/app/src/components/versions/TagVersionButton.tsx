import { css } from "@emotion/react";
import type { ReactNode } from "react";

import {
  Button,
  Checkbox,
  Dialog,
  DialogTrigger,
  Icon,
  Icons,
  Popover,
  PopoverArrow,
  View,
} from "@phoenix/components";
import { DEFAULT_PROMPT_VERSION_TAGS } from "@phoenix/constants";

/**
 * The names every tag picker offers, whether or not the entity has them yet.
 */
export function withDefaultVersionTagNames(
  tagNames: ReadonlyArray<string>
): string[] {
  return Array.from(
    new Set([
      ...DEFAULT_PROMPT_VERSION_TAGS.map((tagDefinition) => tagDefinition.name),
      ...tagNames,
    ])
  );
}

/**
 * The description a default tag is created with; other tags start blank.
 */
export function getDefaultVersionTagDescription(tagName: string): string {
  return (
    DEFAULT_PROMPT_VERSION_TAGS.find(
      (tagDefinition) => tagDefinition.name === tagName
    )?.description ?? ""
  );
}

/**
 * The "Tag Version" button and its popover: a checklist of the tags that
 * can be set on the version, and a "New Tag" button. The caller renders the
 * new-tag dialog as `children` and owns both open states.
 */
export function TagVersionButton({
  isOpen,
  onOpenChange,
  tagList,
  onNewTag,
  children,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  tagList: ReactNode;
  onNewTag: () => void;
  children?: ReactNode;
}) {
  return (
    <div>
      <DialogTrigger isOpen={isOpen} onOpenChange={onOpenChange}>
        <Button
          size="S"
          leadingVisual={<Icon svg={<Icons.PriceTags />} />}
          css={css`
            text-wrap: nowrap;
          `}
        >
          Tag Version
        </Button>
        <Popover placement="bottom end">
          <PopoverArrow />
          <Dialog>
            {tagList}
            <View padding="size-100" width="250px">
              <Button
                leadingVisual={<Icon svg={<Icons.Plus />} />}
                size="S"
                css={css`
                  width: 100%;
                `}
                onPress={onNewTag}
              >
                New Tag
              </Button>
            </View>
          </Dialog>
        </Popover>
      </DialogTrigger>
      {children}
    </div>
  );
}

/**
 * The popover's checklist. A tag already on the version stays checked and
 * disabled; checking another sets it, moving it from its current version.
 */
export function VersionTagCheckboxList({
  tagNames,
  setTagNames,
  isCommitting,
  onSetTag,
}: {
  tagNames: ReadonlyArray<string>;
  setTagNames: ReadonlyArray<string>;
  isCommitting: boolean;
  onSetTag: (tagName: string) => void;
}) {
  return (
    <ul>
      {tagNames.map((tagName) => {
        const isTagSet = setTagNames.includes(tagName);
        return (
          <li key={tagName}>
            <View
              paddingY="size-100"
              paddingX="size-200"
              borderBottomColor="default"
              borderBottomWidth="thin"
            >
              <Checkbox
                name={tagName}
                isSelected={isTagSet}
                isDisabled={isTagSet || isCommitting}
                onChange={(isSelected) => {
                  if (isSelected) {
                    onSetTag(tagName);
                  }
                }}
              >
                {tagName}
              </Checkbox>
            </View>
          </li>
        );
      })}
    </ul>
  );
}
