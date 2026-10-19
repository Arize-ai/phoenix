import { useState } from "react";
import { graphql, useMutation } from "react-relay";

import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogCloseButton,
  DialogTitleExtra,
  DialogTrigger,
  Flex,
  Form,
  Input,
  Modal,
  Label,
  Text,
  TextArea,
  TextField,
  View,
} from "@phoenix/components";
import { validateIdentifier } from "@phoenix/utils/identifierUtils";

import type { DecisionActionsDeleteMutation } from "./__generated__/DecisionActionsDeleteMutation.graphql";
import type { DecisionActionsDeleteTagMutation } from "./__generated__/DecisionActionsDeleteTagMutation.graphql";
import type { DecisionActionsPatchMutation } from "./__generated__/DecisionActionsPatchMutation.graphql";
import type { DecisionActionsSetTagMutation } from "./__generated__/DecisionActionsSetTagMutation.graphql";

export function DeleteDecisionButton({
  decisionId,
  name,
  onDeleted,
}: {
  decisionId: string;
  name: string;
  onDeleted: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [commit, isPending] =
    useMutation<DecisionActionsDeleteMutation>(graphql`
      mutation DecisionActionsDeleteMutation($id: ID!) {
        deleteDecision(input: { decisionId: $id }) {
          query {
            __typename
          }
        }
      }
    `);
  return (
    <DialogTrigger
      isOpen={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        setError(null);
      }}
    >
      <Button size="S" aria-label={`Delete ${name}`}>
        Delete
      </Button>
      <Modal>
        <Dialog>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete decision</DialogTitle>
              <DialogTitleExtra>
                <DialogCloseButton />
              </DialogTitleExtra>
            </DialogHeader>
            <View padding="size-200">
              <Flex direction="column" gap="size-200">
                {error ? <Alert variant="danger">{error}</Alert> : null}
                <Text>
                  Deleting {name} removes all its versions and tags.
                  Applications using this decision will lose access. This cannot
                  be undone.
                </Text>
                <Flex justifyContent="end" gap="size-100">
                  <Button slot="close" variant="default">
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    isDisabled={isPending}
                    onPress={() =>
                      commit({
                        variables: { id: decisionId },
                        onCompleted: (_, errors) => {
                          if (errors?.length) {
                            setError(
                              errors.map((error) => error.message).join("\n")
                            );
                            return;
                          }
                          setIsOpen(false);
                          onDeleted();
                        },
                        onError: (error) => setError(error.message),
                      })
                    }
                  >
                    Delete decision
                  </Button>
                </Flex>
              </Flex>
            </View>
          </DialogContent>
        </Dialog>
      </Modal>
    </DialogTrigger>
  );
}

export function EditDecisionButton({
  decisionId,
  description,
  onSaved,
}: {
  decisionId: string;
  description: string | null;
  onSaved: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState(description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [commit, isPending] = useMutation<DecisionActionsPatchMutation>(graphql`
    mutation DecisionActionsPatchMutation($id: ID!, $description: String) {
      patchDecision(input: { decisionId: $id, description: $description }) {
        id
        description
      }
    }
  `);
  return (
    <DialogTrigger
      isOpen={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        setValue(description ?? "");
        setError(null);
      }}
    >
      <Button size="S">Edit description</Button>
      <Modal>
        <Dialog>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit decision description</DialogTitle>
              <DialogTitleExtra>
                <DialogCloseButton />
              </DialogTitleExtra>
            </DialogHeader>
            <View padding="size-200">
              <Form
                onSubmit={(event) => {
                  event.preventDefault();
                  commit({
                    variables: { id: decisionId, description: value || null },
                    onCompleted: (_, errors) => {
                      if (errors?.length) {
                        setError(
                          errors.map((error) => error.message).join("\n")
                        );
                        return;
                      }
                      setIsOpen(false);
                      onSaved();
                    },
                    onError: (error) => setError(error.message),
                  });
                }}
              >
                {error ? <Alert variant="danger">{error}</Alert> : null}
                <TextField value={value} onChange={setValue}>
                  <Label>Description</Label>
                  <TextArea />
                </TextField>
                <Flex justifyContent="end" gap="size-100">
                  <Button slot="close">Cancel</Button>
                  <Button
                    type="submit"
                    variant="primary"
                    isDisabled={isPending}
                  >
                    Save description
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

export function SetDecisionTagButton({
  versionId,
  tagNames,
  onSaved,
}: {
  versionId: string;
  tagNames: readonly string[];
  onSaved: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [commit, isPending] =
    useMutation<DecisionActionsSetTagMutation>(graphql`
      mutation DecisionActionsSetTagMutation(
        $versionId: ID!
        $name: Identifier!
      ) {
        setDecisionVersionTag(
          input: { decisionVersionId: $versionId, name: $name }
        ) {
          decisionVersionTag {
            id
            name
            decisionVersionId
          }
        }
      }
    `);
  return (
    <DialogTrigger
      isOpen={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        setName("");
        setError(null);
      }}
    >
      <Button size="S">Set version tag</Button>
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
                    variables: { versionId, name },
                    onCompleted: (_, errors) => {
                      if (errors?.length) {
                        setError(
                          errors.map((error) => error.message).join("\n")
                        );
                        return;
                      }
                      setIsOpen(false);
                      onSaved();
                    },
                    onError: (error) => setError(error.message),
                  });
                }}
              >
                {error ? <Alert variant="danger">{error}</Alert> : null}
                <TextField value={name} onChange={setName} isRequired>
                  <Label>Tag name</Label>
                  <Input />
                </TextField>
                <Text>
                  {tagNames.includes(name)
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

export function DeleteDecisionTagButton({
  tagId,
  name,
  onDeleted,
}: {
  tagId: string;
  name: string;
  onDeleted: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commit, isPending] =
    useMutation<DecisionActionsDeleteTagMutation>(graphql`
      mutation DecisionActionsDeleteTagMutation($id: ID!) {
        deleteDecisionVersionTag(input: { decisionVersionTagId: $id }) {
          query {
            __typename
          }
        }
      }
    `);
  return (
    <DialogTrigger
      isOpen={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        setError(null);
      }}
    >
      <Button size="S" aria-label={`Delete tag ${name}`}>
        Remove
      </Button>
      <Modal>
        <Dialog>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove version tag</DialogTitle>
              <DialogTitleExtra>
                <DialogCloseButton />
              </DialogTitleExtra>
            </DialogHeader>
            <View padding="size-200">
              <Flex direction="column" gap="size-200">
                {error ? <Alert variant="danger">{error}</Alert> : null}
                <Text>
                  Applications following {name} will no longer be able to
                  resolve this tag. The version will remain available by ID.
                </Text>
                <Flex justifyContent="end" gap="size-100">
                  <Button slot="close">Cancel</Button>
                  <Button
                    variant="danger"
                    isDisabled={isPending}
                    onPress={() =>
                      commit({
                        variables: { id: tagId },
                        onCompleted: (_, errors) => {
                          if (errors?.length) {
                            setError(
                              errors.map((error) => error.message).join("\n")
                            );
                            return;
                          }
                          setIsOpen(false);
                          onDeleted();
                        },
                        onError: (error) => setError(error.message),
                      })
                    }
                  >
                    Remove tag
                  </Button>
                </Flex>
              </Flex>
            </View>
          </DialogContent>
        </Dialog>
      </Modal>
    </DialogTrigger>
  );
}
