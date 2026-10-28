import { useState } from "react";
import { graphql, useMutation } from "react-relay";

import { DialogTrigger } from "@phoenix/components";
import type { VersionTagFormParams } from "@phoenix/components/versions/NewVersionTagDialog";
import { NewVersionTagDialog } from "@phoenix/components/versions/NewVersionTagDialog";
import {
  getVersionTagDescriptionToSet,
  TagVersionButton,
  VersionTagCheckboxList,
  withDefaultVersionTagNames,
} from "@phoenix/components/versions/TagVersionButton";
import { useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { TagDecisionVersionButtonSetTagMutation } from "./__generated__/TagDecisionVersionButtonSetTagMutation.graphql";

/**
 * Sets a tag on a decision version: an existing tag from the popover's
 * checklist, moving it from the version it was on, or a new one from the
 * dialog. `onTagSet` lets the page refetch the tags.
 */
export function TagDecisionVersionButton({
  versionId,
  decisionTagNames,
  versionTagNames,
  onTagSet,
}: {
  versionId: string;
  /** Every tag the decision has, on any version. */
  decisionTagNames: ReadonlyArray<string>;
  /** The tags on this version. */
  versionTagNames: ReadonlyArray<string>;
  onTagSet: () => void;
}) {
  const [showTagList, setShowTagList] = useState(false);
  const [showNewTagDialog, setShowNewTagDialog] = useState(false);
  const [setTagError, setSetTagError] = useState<string | null>(null);
  const [newTagError, setNewTagError] = useState<string | null>(null);
  const notifySuccess = useNotifySuccess();
  const tagNames = withDefaultVersionTagNames(decisionTagNames);
  const [commitSetTag, isCommitting] =
    useMutation<TagDecisionVersionButtonSetTagMutation>(graphql`
      mutation TagDecisionVersionButtonSetTagMutation(
        $versionId: ID!
        $name: Identifier!
        $description: String
      ) {
        setDecisionVersionTag(
          input: {
            decisionVersionId: $versionId
            name: $name
            description: $description
          }
        ) {
          decisionVersionTag {
            id
            name
            description
            decisionVersionId
          }
        }
      }
    `);

  // A null description keeps a moved tag's description.
  const setTag = ({
    name,
    description,
    onDone,
    onFail,
  }: {
    name: string;
    description: string | null;
    onDone: () => void;
    onFail: (message: string) => void;
  }) =>
    commitSetTag({
      variables: { versionId, name, description },
      onCompleted: (_, errors) => {
        if (errors?.length) {
          onFail(errors.map((error) => error.message).join("\n"));
          return;
        }
        onDone();
        onTagSet();
      },
      onError: (error) =>
        onFail(
          getErrorMessagesFromRelayMutationError(error)?.[0] ?? error.message
        ),
    });

  return (
    <TagVersionButton
      isOpen={showTagList}
      onOpenChange={(isOpen) => {
        setShowTagList(isOpen);
        setSetTagError(null);
      }}
      onNewTag={() => {
        setShowTagList(false);
        setNewTagError(null);
        setShowNewTagDialog(true);
      }}
      tagList={
        <VersionTagCheckboxList
          tagNames={tagNames}
          setTagNames={versionTagNames}
          isCommitting={isCommitting}
          error={setTagError}
          onSetTag={(tagName) => {
            setSetTagError(null);
            setTag({
              name: tagName,
              description: getVersionTagDescriptionToSet(
                tagName,
                decisionTagNames
              ),
              onDone: () =>
                notifySuccess({
                  title: "Tag Set",
                  message: `The tag ${tagName} has been set on the version`,
                }),
              onFail: setSetTagError,
            });
          }}
        />
      }
    >
      <DialogTrigger
        isOpen={showNewTagDialog}
        onOpenChange={setShowNewTagDialog}
      >
        <NewVersionTagDialog
          title="New Decision Tag"
          error={newTagError}
          isCommitting={isCommitting}
          onDismiss={() => setShowNewTagDialog(false)}
          onSubmit={(newTag: VersionTagFormParams) => {
            setNewTagError(null);
            setTag({
              name: newTag.name,
              description: newTag.description.trim() || null,
              onDone: () => {
                setShowNewTagDialog(false);
                notifySuccess({
                  title: "Tag Created",
                  message: `The tag ${newTag.name} has been created and set on the decision version`,
                });
              },
              onFail: setNewTagError,
            });
          }}
        />
      </DialogTrigger>
    </TagVersionButton>
  );
}
