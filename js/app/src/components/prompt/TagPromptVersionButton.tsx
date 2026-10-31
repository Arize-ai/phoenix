import { css } from "@emotion/react";
import { Suspense, useMemo, useState } from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";

import {
  Button,
  Checkbox,
  Dialog,
  DialogTrigger,
  Flex,
  Icon,
  IconButton,
  Icons,
  Loading,
  Popover,
  PopoverArrow,
  Text,
  View,
} from "@phoenix/components";
import type { TagPromptVersionButtonDeleteTagMutation } from "@phoenix/components/prompt/__generated__/TagPromptVersionButtonDeleteTagMutation.graphql";
import type { TagPromptVersionButtonSetTagMutation } from "@phoenix/components/prompt/__generated__/TagPromptVersionButtonSetTagMutation.graphql";
import type { TagPromptVersionButtonTagsQuery } from "@phoenix/components/prompt/__generated__/TagPromptVersionButtonTagsQuery.graphql";
import { DEFAULT_PROMPT_VERSION_TAGS } from "@phoenix/constants";
import { useNotifySuccess } from "@phoenix/contexts";
import { NewPromptVersionDialog } from "@phoenix/pages/prompt/NewPromptVersionTagDialog";

import {
  movePromptVersionTag,
  removePromptVersionTag,
} from "./movePromptVersionTag";

type TagPromptVersionButtonProps = {
  promptId: string;
  versionId: string;
};

export function TagPromptVersionButton({
  promptId,
  versionId,
}: TagPromptVersionButtonProps) {
  const [showTagList, setShowTagList] = useState<boolean>(false);
  const [showNewTagDialog, setShowNewTagDialog] = useState<boolean>(false);
  const [fetchKey, setFetchKey] = useState<number>(0);
  const [restoreTargets, setRestoreTargets] = useState<RestoreTargets>({});
  const notifySuccess = useNotifySuccess();

  return (
    <>
      <DialogTrigger isOpen={showTagList} onOpenChange={setShowTagList}>
        <IconButton size="S" aria-label="Edit tags">
          <Icon svg={<Icons.PriceTags />} />
        </IconButton>
        <Popover placement="bottom start">
          <PopoverArrow />
          <Dialog>
            <Suspense
              fallback={
                <View padding="size-100">
                  <Loading size="S" />
                </View>
              }
            >
              <TagList
                promptId={promptId}
                versionId={versionId}
                fetchKey={fetchKey}
                restoreTargets={restoreTargets}
                onRestoreTargetsChange={setRestoreTargets}
                onTagChanged={(notification) => {
                  setFetchKey((prev) => prev + 1);
                  notifySuccess(notification);
                }}
              />
            </Suspense>
            <View padding="size-100" width="250px">
              <Button
                leadingVisual={<Icon svg={<Icons.Plus />} />}
                size="S"
                css={css`
                  width: 100%;
                `}
                onPress={() => {
                  setShowTagList(false);
                  setShowNewTagDialog(true);
                }}
              >
                New Tag
              </Button>
            </View>
          </Dialog>
        </Popover>
      </DialogTrigger>
      <DialogTrigger
        isOpen={showNewTagDialog}
        onOpenChange={(isOpen) => {
          setShowNewTagDialog(isOpen);
        }}
      >
        <NewPromptVersionDialog
          promptId={promptId}
          promptVersionId={versionId}
          onDismiss={() => setShowNewTagDialog(false)}
          onNewTagCreated={(newTag) => {
            setFetchKey((prev) => prev + 1);
            notifySuccess({
              title: "Tag Created",
              message: `The tag ${newTag.name} has been created and set on the prompt version`,
            });
          }}
        />
      </DialogTrigger>
    </>
  );
}

/**
 * For each tag checked from this menu, the version it was taken from, or null
 * when the tag did not exist. Unchecking the tag restores that state, so a
 * mistaken check can be undone.
 */
type RestoreTargets = Record<string, string | null>;

function TagList({
  promptId,
  versionId,
  fetchKey,
  restoreTargets,
  onRestoreTargetsChange,
  onTagChanged,
}: {
  promptId: string;
  versionId: string;
  fetchKey: number;
  restoreTargets: RestoreTargets;
  onRestoreTargetsChange: (restoreTargets: RestoreTargets) => void;
  onTagChanged: (notification: { title: string; message: string }) => void;
}) {
  const data = useLazyLoadQuery<TagPromptVersionButtonTagsQuery>(
    graphql`
      query TagPromptVersionButtonTagsQuery($promptId: ID!) {
        prompt: node(id: $promptId) {
          ... on Prompt {
            versionTags {
              id
              name
              promptVersionId
            }
            promptVersions {
              edges {
                version: node {
                  id
                  ... on PromptVersion {
                    sequenceNumber
                  }
                }
              }
            }
          }
        }
      }
    `,
    { promptId },
    { fetchKey, fetchPolicy: "store-and-network" }
  );

  const tagsByName = useMemo(() => {
    return new Map(
      (data?.prompt?.versionTags ?? []).map((tag) => [tag.name, tag])
    );
  }, [data?.prompt?.versionTags]);

  const sequenceNumberByVersionId = useMemo(() => {
    return new Map(
      (data?.prompt?.promptVersions?.edges ?? []).map(({ version }) => [
        version.id,
        version.sequenceNumber,
      ])
    );
  }, [data?.prompt?.promptVersions]);

  const allVersionTagsWithDefaults = useMemo(() => {
    return Array.from(
      new Set([
        ...DEFAULT_PROMPT_VERSION_TAGS.map(
          (tagDefinition) => tagDefinition.name
        ),
        ...tagsByName.keys(),
      ])
    );
  }, [tagsByName]);

  const [commitSetTag, isSetting] =
    useMutation<TagPromptVersionButtonSetTagMutation>(graphql`
      mutation TagPromptVersionButtonSetTagMutation(
        $input: SetPromptVersionTagInput!
        $promptId: ID!
      ) {
        setPromptVersionTag(input: $input) {
          promptVersionTag {
            id
            promptVersionId
          }
          query {
            prompt: node(id: $promptId) {
              ... on Prompt {
                ...PromptVersionTagsConfig_data
              }
            }
          }
        }
      }
    `);
  const [commitDeleteTag, isDeleting] =
    useMutation<TagPromptVersionButtonDeleteTagMutation>(graphql`
      mutation TagPromptVersionButtonDeleteTagMutation(
        $input: DeletePromptVersionTagInput!
        $promptId: ID!
      ) {
        deletePromptVersionTag(input: $input) {
          query {
            prompt: node(id: $promptId) {
              ... on Prompt {
                ...PromptVersionTagsConfig_data
              }
            }
          }
        }
      }
    `);
  const isCommitting = isSetting || isDeleting;

  const commitMoveTag = ({
    tagName,
    targetVersionId,
    previousVersionId,
    description,
    onCompleted,
  }: {
    tagName: string;
    targetVersionId: string;
    previousVersionId?: string;
    description?: string;
    onCompleted: () => void;
  }) => {
    commitSetTag({
      variables: {
        input: { name: tagName, promptVersionId: targetVersionId, description },
        promptId,
      },
      updater: (store, response) => {
        const tagId = response?.setPromptVersionTag.promptVersionTag?.id;
        if (tagId) {
          if (previousVersionId) {
            removePromptVersionTag({
              store,
              promptId,
              versionId: previousVersionId,
              tagId,
            });
          }
          movePromptVersionTag({
            store,
            promptId,
            versionId: targetVersionId,
            tagId,
          });
        }
      },
      onCompleted,
    });
  };

  const setTag = (tagName: string) => {
    const existingTag = tagsByName.get(tagName);
    const description = existingTag
      ? undefined
      : DEFAULT_PROMPT_VERSION_TAGS.find(
          (tagDefinition) => tagDefinition.name === tagName
        )?.description;
    commitMoveTag({
      tagName,
      targetVersionId: versionId,
      description,
      onCompleted: () => {
        onRestoreTargetsChange({
          ...restoreTargets,
          [tagName]: existingTag?.promptVersionId ?? null,
        });
        onTagChanged({
          title: "Tag Set",
          message: `The tag ${tagName} has been set on the version`,
        });
      },
    });
  };

  const unsetTag = (tagName: string) => {
    const tag = tagsByName.get(tagName);
    if (!tag) {
      return;
    }
    const { [tagName]: restoreVersionId, ...remainingRestoreTargets } =
      restoreTargets;
    const onCompleted = (message: string) => {
      onRestoreTargetsChange(remainingRestoreTargets);
      onTagChanged({ title: "Tag Removed", message });
    };
    if (restoreVersionId) {
      commitMoveTag({
        tagName,
        targetVersionId: restoreVersionId,
        previousVersionId: tag.promptVersionId,
        onCompleted: () => {
          const sequenceNumber =
            sequenceNumberByVersionId.get(restoreVersionId);
          onCompleted(
            `The tag ${tagName} has been moved back to ${sequenceNumber != null ? `v${sequenceNumber}` : "its previous version"}`
          );
        },
      });
      return;
    }
    commitDeleteTag({
      variables: { input: { promptVersionTagId: tag.id }, promptId },
      updater: (store) => {
        removePromptVersionTag({
          store,
          promptId,
          versionId: tag.promptVersionId,
          tagId: tag.id,
        });
      },
      onCompleted: () => {
        onCompleted(`The tag ${tagName} has been deleted`);
      },
    });
  };

  return (
    <ul>
      {allVersionTagsWithDefaults.map((tagName: string) => {
        const tag = tagsByName.get(tagName);
        const isTagSet = tag?.promptVersionId === versionId;
        const canUnset = restoreTargets[tagName] !== undefined;
        const otherVersionSequenceNumber =
          tag && !isTagSet
            ? sequenceNumberByVersionId.get(tag.promptVersionId)
            : undefined;
        return (
          <li key={tagName}>
            <View
              paddingY="size-100"
              paddingX="size-200"
              borderBottomColor="default"
              borderBottomWidth="thin"
            >
              <Flex
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                gap="size-100"
              >
                <Checkbox
                  name={tagName}
                  isSelected={isTagSet}
                  isDisabled={isCommitting || (isTagSet && !canUnset)}
                  onChange={(isSelected) => {
                    if (isSelected) {
                      setTag(tagName);
                    } else {
                      unsetTag(tagName);
                    }
                  }}
                >
                  {tagName}
                </Checkbox>
                {otherVersionSequenceNumber != null ? (
                  <Text size="XS" color="text-500" fontFamily="mono">
                    {`v${otherVersionSequenceNumber}`}
                  </Text>
                ) : null}
              </Flex>
            </View>
          </li>
        );
      })}
    </ul>
  );
}
