import { Suspense, useMemo, useState } from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";

import { DialogTrigger, Loading, View } from "@phoenix/components";
import type { TagPromptVersionButtonSetTagMutation } from "@phoenix/components/prompt/__generated__/TagPromptVersionButtonSetTagMutation.graphql";
import type { TagPromptVersionButtonTagsQuery } from "@phoenix/components/prompt/__generated__/TagPromptVersionButtonTagsQuery.graphql";
import {
  getDefaultVersionTagDescription,
  TagVersionButton,
  VersionTagCheckboxList,
  withDefaultVersionTagNames,
} from "@phoenix/components/versions/TagVersionButton";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { NewPromptVersionDialog } from "@phoenix/pages/prompt/NewPromptVersionTagDialog";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import { movePromptVersionTag } from "./movePromptVersionTag";

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
  const notifySuccess = useNotifySuccess();

  return (
    <TagVersionButton
      isOpen={showTagList}
      onOpenChange={setShowTagList}
      onNewTag={() => {
        setShowTagList(false);
        setShowNewTagDialog(true);
      }}
      tagList={
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
      }
    >
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
    </TagVersionButton>
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
  const notifyError = useNotifyError();
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

  const allVersionTagsWithDefaults = useMemo(
    () =>
      withDefaultVersionTagNames(
        data?.prompt?.versionTags?.map((tag) => tag.name) || []
      ),
    [data?.prompt?.versionTags]
  );

  const tagsSetOnVersion = useMemo(() => {
    return data?.promptVersion?.tags?.map((tag) => tag.name) || [];
  }, [data?.promptVersion?.tags]);

  const [commitSetTag, isCommitting] =
    useMutation<TagPromptVersionButtonSetTagMutation>(graphql`
      mutation TagPromptVersionButtonSetTagMutation(
        $input: SetPromptVersionTagInput!
      ) {
        setPromptVersionTag(input: $input) {
          promptVersionTag {
            id
            name
            promptVersionId
          }
        }
      }
    `);
  return (
    <VersionTagCheckboxList
      tagNames={allVersionTagsWithDefaults}
      setTagNames={tagsSetOnVersion}
      isCommitting={isCommitting}
      onSetTag={(tagName) =>
        commitSetTag({
          variables: {
            input: {
              name: tagName,
              promptVersionId: versionId,
              description: getDefaultVersionTagDescription(tagName),
            },
          },
          updater: (store, data) => {
            const tagId = data?.setPromptVersionTag.promptVersionTag?.id;
            if (tagId) {
              movePromptVersionTag({
                store,
                promptId,
                versionId,
                tagId,
              });
            }
          },
          onCompleted: () => {
            onTagSet(tagName);
          },
          onError: (error) => {
            notifyError({
              title: "Failed to set tag",
              message:
                getErrorMessagesFromRelayMutationError(error)?.[0] ??
                error.message,
            });
          },
        })
      }
    />
  );
}
