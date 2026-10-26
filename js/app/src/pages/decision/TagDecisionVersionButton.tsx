import { css } from "@emotion/react";
import { useState } from "react";
import { graphql, useMutation } from "react-relay";

import {
  Alert,
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  DialogTrigger,
  Flex,
  Form,
  Icon,
  Icons,
  Input,
  Label,
  Modal,
  Text,
  TextArea,
  TextField,
  View,
} from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";
import { validateIdentifier } from "@phoenix/utils/identifierUtils";

import type { TagDecisionVersionButtonSetTagMutation } from "./__generated__/TagDecisionVersionButtonSetTagMutation.graphql";

/**
 * Sets a tag on a decision version, or moves an existing tag to it
 */
export function TagDecisionVersionButton({
  versionId,
  tagNames,
}: {
  versionId: string;
  /**
   * The names of the decision's existing tags
   */
  tagNames: readonly string[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const notifySuccess = useNotifySuccess();
  const [commit, isPending] =
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
          decision {
            versionTags {
              id
              name
            }
            ...DecisionVersionsList__main
            ...DecisionLatestVersionsListFragment
            ...DecisionVersionTagsConfigCard_data
          }
        }
      }
    `);
  const isExistingTag = tagNames.includes(name);
  return (
    <DialogTrigger
      isOpen={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        setName("");
        setDescription("");
        setError(null);
      }}
    >
      <Button
        size="S"
        leadingVisual={<Icon svg={<Icons.PriceTags />} />}
        css={css`
          text-wrap: nowrap;
        `}
      >
        Tag Version
      </Button>
      <Modal>
        <Dialog>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set version tag</DialogTitle>
              <DialogTitleExtra>
                <DialogCloseButton />
              </DialogTitleExtra>
            </DialogHeader>
            <View padding="size-200">
              <Form
                onSubmit={(event) => {
                  event.preventDefault();
                  const validation = validateIdentifier(name);
                  if (validation !== true) {
                    setError(
                      typeof validation === "string"
                        ? validation
                        : "Invalid tag name"
                    );
                    return;
                  }
                  commit({
                    // An empty description keeps a moved tag's description.
                    variables: {
                      versionId,
                      name,
                      description: description.trim() || null,
                    },
                    onCompleted: (_, errors) => {
                      if (errors?.length) {
                        setError(
                          errors.map((error) => error.message).join("\n")
                        );
                        return;
                      }
                      setIsOpen(false);
                      notifySuccess({
                        title: "Tag Set",
                        message: `The tag ${name} has been set on the version`,
                      });
                    },
                    onError: (error) =>
                      setError(
                        getErrorMessagesFromRelayMutationError(error)?.[0] ??
                          error.message
                      ),
                  });
                }}
              >
                {error ? <Alert variant="danger">{error}</Alert> : null}
                <TextField value={name} onChange={setName} isRequired>
                  <Label>Tag name</Label>
                  <Input />
                </TextField>
                <TextField value={description} onChange={setDescription}>
                  <Label>Description</Label>
                  <TextArea placeholder="A description of the tag" />
                  <Text slot="description">
                    {isExistingTag
                      ? "Optional. Leave empty to keep the tag's description."
                      : "Optional."}
                  </Text>
                </TextField>
                <Text>
                  {isExistingTag
                    ? `The existing tag ${name} will move to this version. Applications following it will use this version.`
                    : "Applications following this tag will use the selected version."}
                </Text>
                <Flex justifyContent="end" gap="size-100">
                  <Button slot="close">Cancel</Button>
                  <Button
                    type="submit"
                    variant="primary"
                    isDisabled={isPending}
                  >
                    Set tag
                  </Button>
                </Flex>
              </Form>
            </View>
          </DialogContent>
        </Dialog>
      </Modal>
    </DialogTrigger>
  );
}
