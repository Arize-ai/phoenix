import { css } from "@emotion/react";
import type { ReactNode } from "react";

import {
  Alert,
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
 * The description to send when setting `tagName` from the checklist: a
 * default tag's description when the tag does not exist yet, otherwise null
 * so that a moved tag keeps the description it has.
 */
export function getVersionTagDescriptionToSet(
  tagName: string,
  existingTagNames: ReadonlyArray<string>
): string | null {
  if (existingTagNames.includes(tagName)) return null;
  return (
    DEFAULT_PROMPT_VERSION_TAGS.find(
      (tagDefinition) => tagDefinition.name === tagName
    )?.description || null
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
 * `error` is the last failure to set a tag, shown above the list.
 */
export function VersionTagCheckboxList({
  tagNames,
  setTagNames,
  isCommitting,
  onSetTag,
  error,
}: {
  tagNames: ReadonlyArray<string>;
  setTagNames: ReadonlyArray<string>;
  isCommitting: boolean;
  onSetTag: (tagName: string) => void;
  error?: string | null;
}) {
  return (
    <>
      {error ? (
        <View padding="size-100" width="250px">
          <Alert variant="danger" banner>
            {error}
          </Alert>
        </View>
      ) : null}
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
    </>
  );
}
