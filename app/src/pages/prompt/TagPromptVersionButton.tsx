import { Suspense, useMemo, useState } from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import { useParams } from "react-router";
import { css } from "@emotion/react";

import {
  Button,
  Dialog,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Loading,
  Popover,
  PopoverArrow,
  View,
} from "@phoenix/components";
import { DEFAULT_PROMPT_VERSION_TAGS } from "@phoenix/constants";
import { useNotifySuccess } from "@phoenix/contexts";

import { TagPromptVersionButtonTagsQuery } from "./__generated__/TagPromptVersionButtonTagsQuery.graphql";
import { NewPromptVersionDialog } from "./NewPromptVersionTagDialog";
export function TagPromptVersionButton() {
  const [showNewTagDialog, setShowNewTagDialog] = useState<boolean>(false);
  const [fetchKey, setFetchKey] = useState<number>(0);
  const notifySuccess = useNotifySuccess();
  const { promptId, versionId } = useParams();
  if (!promptId) {
    throw new Error("Expected promptId to be defined");
  }
  if (!versionId) {
    throw new Error("Expected versionId to be defined");
  }

  return (
    <div>
      <DialogTrigger>
        <Button
          size="S"
          leadingVisual={<Icon svg={<Icons.PriceTagsOutline />} />}
        >
          Tag Version
        </Button>
        <Popover placement="bottom end">
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
                onTagSet={(tagName) => {
                  setFetchKey((prev) => prev + 1);
                  notifySuccess({
                    title: "Tag Set",
                    message: `The tag ${tagName} has been set on the version`,
                  });
                }}
              />
            </Suspense>
            <View padding="size-100" width="250px">
              <Button
                leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
                size="S"
                css={css`
                  width: 100%;
                `}
                onPress={() => setShowNewTagDialog(true)}
              >
                New Tag
              </Button>
            </View>
          </Dialog>
        </Popover>
      </DialogTrigger>
      {showNewTagDialog && (
        <NewPromptVersionDialog
          promptVersionId={versionId}
          onDismiss={() => setShowNewTagDialog(false)}
          onNewTagCreated={(newTag) => {
            setFetchKey((prev) => prev + 1);
            notifySuccess({
              title: "Tag Created",
              message: `The tag ${newTag.name} has been created and been set on the version`,
            });
          }}
        />
      )}
    </div>
  );
}

function TagList({
  promptId,
  versionId,
  fetchKey,
  onTagSet,
}: {
  promptId: string;
  versionId: string;
  fetchKey: number;
  onTagSet: (tagName: string) => void;
}) {
  const data = useLazyLoadQuery<TagPromptVersionButtonTagsQuery>(
    graphql`
      query TagPromptVersionButtonTagsQuery($promptId: ID!, $versionId: ID!) {
        prompt: node(id: $promptId) {
          ... on Prompt {
            versionTags {
              id
              name
            }
          }
        }
        promptVersion: node(id: $versionId) {
          ... on PromptVersion {
            tags {
              id
              name
            }
          }
        }
      }
    `,
    { promptId, versionId },
    { fetchKey, fetchPolicy: "store-and-network" }
  );

  const allVersionTags = useMemo(() => {
    return data?.prompt?.versionTags?.map((tag) => tag.name) || [];
  }, [data?.prompt?.versionTags]);

  const tagsSetOnVersion = useMemo(() => {
    return data?.promptVersion?.tags?.map((tag) => tag.name) || [];
  }, [data?.promptVersion?.tags]);

  const allVersionTagsWithDefaults = useMemo(() => {
    return Array.from(
      new Set([
        ...DEFAULT_PROMPT_VERSION_TAGS.map(
          (tagDefinition) => tagDefinition.name
        ),
        ...allVersionTags,
      ])
    );
  }, [allVersionTags]);

  const [commitSetTag, isCommitting] = useMutation(graphql`
    mutation TagPromptVersionButtonSetTagMutation(
      $input: SetPromptVersionTagInput!
      $promptId: ID!
    ) {
      setPromptVersionTag(input: $input) {
        query {
          prompt: node(id: $promptId) {
            ... on Prompt {
              ...PromptVersionsList__main
            }
          }
        }
      }
    }
  `);
  return (
    <ul>
      {allVersionTagsWithDefaults.map((tagName: string) => {
        const isTagSet = tagsSetOnVersion.includes(tagName);
        return (
          <li key={tagName}>
            <View
              paddingY="size-100"
              paddingX="size-200"
              borderBottomColor="light"
              borderBottomWidth="thin"
            >
              <Flex direction="row" gap="size-100" alignItems="center">
                <input
                  type="checkbox"
                  name={tagName}
                  checked={isTagSet}
                  disabled={isTagSet || isCommitting}
                  onChange={(e) => {
                    if (e.target.checked) {
                      const isCreate = !tagsSetOnVersion.includes(tagName);
                      let description = "";
                      if (isCreate) {
                        const tagDefinition = DEFAULT_PROMPT_VERSION_TAGS.find(
                          (tagDefinition) => tagDefinition.name === tagName
                        );
                        description = tagDefinition?.description || "";
                      }

                      commitSetTag({
                        variables: {
                          input: {
                            name: tagName,
                            promptVersionId: versionId,
                            description,
                          },
                          promptId: promptId,
                        },
                        onCompleted: () => {
                          onTagSet(tagName);
                        },
                      });
                    }
                  }}
                />
                <span>{tagName}</span>
              </Flex>
            </View>
          </li>
        );
      })}
    </ul>
  );
}
