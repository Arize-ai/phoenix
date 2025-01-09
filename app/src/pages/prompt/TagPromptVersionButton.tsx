import React, { Suspense, useState } from "react";
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
        <Button size="S" icon={<Icon svg={<Icons.PriceTagsOutline />} />}>
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
                icon={<Icon svg={<Icons.PlusOutline />} />}
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
      query TagPromptVersionButtonTagsQuery(
        $promptId: GlobalID!
        $versionId: GlobalID!
      ) {
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
  const allVersionTags =
    data?.prompt?.versionTags?.map((tag) => tag.name) || [];
  const versionTags = data?.promptVersion?.tags?.map((tag) => tag.name) || [];

  const [commitSetTag, isCommitting] = useMutation(graphql`
    mutation TagPromptVersionButtonSetTagMutation(
      $input: SetPromptVersionTagInput!
      $promptVersionId: GlobalID!
    ) {
      setPromptVersionTag(input: $input) {
        query {
          node(id: $promptVersionId) {
            ...PromptVersionTagsList_data
          }
        }
      }
    }
  `);
  return (
    <ul>
      {allVersionTags.map((tagName) => {
        const isTagSet = versionTags.includes(tagName);
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
                      commitSetTag({
                        variables: {
                          input: {
                            name: tagName,
                            promptVersionId: versionId,
                          },
                          promptVersionId: versionId,
                        },
                        onCompleted: () => {
                          onTagSet(tagName);
                        },
                      });
                    }
                  }}
                />
                {tagName}
              </Flex>
            </View>
          </li>
        );
      })}
    </ul>
  );
}
