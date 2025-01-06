import React, { Suspense } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useParams } from "react-router";

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

import { TagPromptVersionButtonTagsQuery } from "./__generated__/TagPromptVersionButtonTagsQuery.graphql";

export function TagPromptVersionButton() {
  const { promptId, versionId } = useParams();
  if (!promptId) {
    throw new Error("Expected promptId to be defined");
  }
  if (!versionId) {
    throw new Error("Expected versionId to be defined");
  }

  return (
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
            <TagList promptId={promptId} versionId={versionId} />
          </Suspense>
          <View padding="size-100" width="250px">
            <Button
              icon={<Icon svg={<Icons.PlusOutline />} />}
              size="S"
              width="100%"
            >
              New Tag
            </Button>
          </View>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

function TagList({
  promptId,
  versionId,
}: {
  promptId: string;
  versionId: string;
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
              name
            }
          }
        }
        promptVersion: node(id: $versionId) {
          ... on PromptVersion {
            tags {
              name
            }
          }
        }
      }
    `,
    { promptId, versionId }
  );
  const allVersionTags =
    data?.prompt?.versionTags?.map((tag) => tag.name) || [];
  const versionTags = data?.promptVersion?.tags?.map((tag) => tag.name) || [];
  return (
    <ul>
      {allVersionTags.map((tagName) => {
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
                  checked={versionTags.includes(tagName)}
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
