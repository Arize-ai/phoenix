import React, { useCallback } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useMutation } from "react-relay";
import { useNavigate } from "react-router";

import {
  Button,
  Card,
  Flex,
  Form,
  Heading,
  Text,
  TextField,
  View,
} from "@arizeai/components";

import { UserPicture } from "@phoenix/components/user/UserPicture";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { useViewer } from "@phoenix/contexts/ViewerContext";

import { ViewerProfileCardMutation } from "./__generated__/ViewerProfileCardMutation.graphql";

type EditProfileFormParams = {
  username: string;
};
export function ViewerProfileCard() {
  const { viewer, refetchViewer } = useViewer();
  const notifyError = useNotifyError();
  const notifySuccess = useNotifySuccess();
  const [commit, isCommitting] = useMutation<ViewerProfileCardMutation>(graphql`
    mutation ViewerProfileCardMutation($input: PatchViewerInput!) {
      patchViewer(input: $input) {
        __typename
      }
    }
  `);
  const navigate = useNavigate();
  const {
    control,
    handleSubmit,
    formState: { isDirty },
    reset,
  } = useForm<EditProfileFormParams>({
    defaultValues: {
      username: viewer?.username || "",
    },
  });

  const onSubmit = useCallback(
    (data: EditProfileFormParams) => {
      commit({
        variables: {
          input: {
            newUsername: data.username,
          },
        },
        onCompleted: () => {
          notifySuccess({
            title: "Profile updated",
            message: "Your profile has been updated",
          });
          reset({ username: data.username });
          refetchViewer();
        },
        onError: (error) => {
          notifyError({
            title: "Failed update profile",
            message: error.message,
          });
        },
      });
    },
    [commit, notifySuccess, reset, refetchViewer, notifyError]
  );
  if (!viewer) {
    return null;
  }
  return (
    <Card
      title="Profile"
      variant="compact"
      bodyStyle={{ padding: 0 }}
      extra={
        viewer.authMethod === "LOCAL" && (
          <Button
            variant="default"
            size="compact"
            onClick={() => {
              navigate("/reset-password");
            }}
          >
            Reset Password
          </Button>
        )
      }
    >
      <View paddingTop="size-200" paddingStart="size-200" paddingEnd="size-200">
        <Flex direction="row" gap="size-200" alignItems="center">
          <UserPicture
            name={viewer.username || viewer.email}
            profilePictureUrl={viewer.profilePictureUrl}
          />
          <Flex direction="column" gap="size-50">
            <Heading level={2} weight="heavy">
              {viewer.username || viewer.email}
            </Heading>
            <Text>{viewer.role.name.toLocaleLowerCase()}</Text>
          </Flex>
        </Flex>
      </View>
      <View>
        <Form onSubmit={handleSubmit(onSubmit)}>
          <View padding="size-200">
            <TextField label="Email" value={viewer.email} isReadOnly />
            <Controller
              name="username"
              control={control}
              rules={{
                required: "A username is required as it needs to be unique",
              }}
              render={({
                field: { name, onChange, onBlur, value },
                fieldState: { invalid, error },
              }) => (
                <TextField
                  label="Username"
                  isRequired
                  description="A unique username"
                  name={name}
                  errorMessage={error?.message}
                  validationState={invalid ? "invalid" : "valid"}
                  onChange={onChange}
                  onBlur={onBlur}
                  defaultValue={value}
                />
              )}
            />
          </View>
          <View
            paddingTop="size-100"
            paddingBottom="size-100"
            paddingStart="size-200"
            paddingEnd="size-200"
            borderTopColor="dark"
            borderTopWidth="thin"
          >
            <Flex direction="row" gap="size-100" justifyContent="end">
              <Button
                variant={isDirty ? "primary" : "default"}
                size="compact"
                disabled={!isDirty}
                onClick={() => {
                  handleSubmit(onSubmit)();
                }}
              >
                {isCommitting ? "Saving..." : "Save"}
              </Button>
            </Flex>
          </View>
        </Form>
      </View>
    </Card>
  );
}
