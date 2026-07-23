import { css } from "@emotion/react";
import { useState } from "react";
import { graphql, useFragment, useMutation } from "react-relay";

import {
  Alert,
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  Flex,
  Form,
  Icon,
  Icons,
  Input,
  Label,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { EditAgentSessionTitleDialog_session$key } from "./__generated__/EditAgentSessionTitleDialog_session.graphql";
import type { EditAgentSessionTitleDialogMutation } from "./__generated__/EditAgentSessionTitleDialogMutation.graphql";

const inlineDialogCSS = css`
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  background: var(--global-background-color-default);
  color: var(--global-text-color-900);
  overflow: hidden;
`;

const inlineHeaderCSS = css`
  padding: var(--global-dimension-size-150) var(--global-dimension-size-200) 0;
`;

const inlineFooterCSS = css`
  padding: 0 var(--global-dimension-size-200) var(--global-dimension-size-200);
`;

type EditAgentSessionTitleProps = {
  session: EditAgentSessionTitleDialog_session$key;
  onClose: () => void;
};

export function EditAgentSessionTitleDialog(props: EditAgentSessionTitleProps) {
  return (
    <Dialog>
      <DialogContent>
        <EditAgentSessionTitleForm {...props} presentation="dialog" />
      </DialogContent>
    </Dialog>
  );
}

export function InlineEditAgentSessionTitle(props: EditAgentSessionTitleProps) {
  return (
    <section
      css={inlineDialogCSS}
      role="dialog"
      aria-label="Edit session title"
    >
      <EditAgentSessionTitleForm {...props} presentation="inline" />
    </section>
  );
}

function EditAgentSessionTitleForm({
  session,
  onClose,
  presentation,
}: EditAgentSessionTitleProps & { presentation: "dialog" | "inline" }) {
  const data = useFragment(
    graphql`
      fragment EditAgentSessionTitleDialog_session on AgentSession {
        id
        title
      }
    `,
    session
  );
  const [title, setTitle] = useState(data.title);
  const [error, setError] = useState<string | null>(null);
  const [commitUpdate, isUpdating] =
    useMutation<EditAgentSessionTitleDialogMutation>(graphql`
      mutation EditAgentSessionTitleDialogMutation(
        $input: UpdateAgentSessionTitleInput!
      ) {
        updateAgentSessionTitle(input: $input) {
          agentSession {
            ...EditAgentSessionTitleDialog_session
          }
          query {
            ...SettingsAgentSessionsCard_sessions @arguments(first: 20)
          }
        }
      }
    `);
  const trimmedTitle = title.trim();
  const isSaveDisabled =
    isUpdating || !trimmedTitle || trimmedTitle === data.title;

  const updateTitle = () => {
    if (isSaveDisabled) {
      return;
    }
    setError(null);
    commitUpdate({
      variables: {
        input: {
          id: data.id,
          title: trimmedTitle,
        },
      },
      onCompleted: onClose,
      onError: (mutationError) => {
        setError(
          getErrorMessagesFromRelayMutationError(mutationError)?.[0] ??
            "Failed to update assistant session title"
        );
      },
    });
  };
  const header =
    presentation === "dialog" ? (
      <DialogHeader>
        <DialogTitle>Edit session title</DialogTitle>
        <DialogTitleExtra>
          <DialogCloseButton onPress={onClose} />
        </DialogTitleExtra>
      </DialogHeader>
    ) : (
      <Flex
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        css={inlineHeaderCSS}
      >
        <Text elementType="h3" size="L" weight="heavy">
          Edit session title
        </Text>
        <Button
          variant="quiet"
          size="S"
          aria-label="Close title editor"
          onPress={onClose}
          leadingVisual={<Icon svg={<Icons.Close />} />}
        />
      </Flex>
    );
  const actions = (
    <>
      <Button
        size="S"
        variant="default"
        onPress={onClose}
        isDisabled={isUpdating}
      >
        Cancel
      </Button>
      <Button
        size="S"
        variant={isSaveDisabled ? "default" : "primary"}
        type="submit"
        isDisabled={isSaveDisabled}
      >
        {isUpdating ? "Saving..." : "Save"}
      </Button>
    </>
  );

  return (
    <>
      {header}
      {error ? (
        <View paddingX="size-200" paddingTop="size-100">
          <Alert variant="danger" banner>
            {error}
          </Alert>
        </View>
      ) : null}
      <Form
        onSubmit={(event) => {
          event.preventDefault();
          updateTitle();
        }}
      >
        <View padding="size-200">
          <TextField
            value={title}
            onChange={setTitle}
            isDisabled={isUpdating}
            isInvalid={!trimmedTitle}
            autoFocus
          >
            <Label>Title</Label>
            <Input />
            <Text slot="description">The title cannot be empty.</Text>
          </TextField>
        </View>
        {presentation === "dialog" ? (
          <DialogFooter>{actions}</DialogFooter>
        ) : (
          <Flex justifyContent="end" gap="size-100" css={inlineFooterCSS}>
            {actions}
          </Flex>
        )}
      </Form>
    </>
  );
}
