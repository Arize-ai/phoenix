import { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useMutation } from "react-relay";
import { useNavigate } from "react-router";

import type { ButtonProps } from "@phoenix/components";
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
  DialogTrigger,
  FieldError,
  Flex,
  Form,
  Icon,
  Icons,
  Input,
  Label,
  ListBox,
  Modal,
  ModalOverlay,
  Popover,
  Select,
  SelectItem,
  SelectValue,
  Text,
  TextArea,
  TextField,
  View,
} from "@phoenix/components";
import { SelectChevronUpDownIcon } from "@phoenix/components/core/icon";
import { GradientCircle } from "@phoenix/components/project/GradientCircle";
import { URI_SAFE_PATTERN } from "@phoenix/constants";
import { useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { NewProjectButtonCreateProjectMutation } from "./__generated__/NewProjectButtonCreateProjectMutation.graphql";
import { GRADIENT_PRESETS } from "./ProjectForm";

type NewProjectButtonProps = {
  variant?: ButtonProps["variant"];
  onProjectCreated: () => void;
};

export function NewProjectButton({
  variant,
  onProjectCreated,
}: NewProjectButtonProps) {
  return (
    <div>
      <DialogTrigger>
        <Button
          leadingVisual={<Icon svg={<Icons.GridOutline />} />}
          size="M"
          variant={variant}
        >
          New Project
        </Button>
        <ModalOverlay>
          <Modal>
            <NewProjectDialog onProjectCreated={onProjectCreated} />
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
    </div>
  );
}

function NewProjectDialog({
  onProjectCreated,
}: {
  onProjectCreated: () => void;
}) {
  const navigate = useNavigate();
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | null>(null);

  const [commit, isCommitting] =
    useMutation<NewProjectButtonCreateProjectMutation>(graphql`
      mutation NewProjectButtonCreateProjectMutation($input: CreateProjectInput!) {
        createProject(input: $input) {
          project {
            id
            name
            gradientStartColor
            gradientEndColor
          }
          query {
            projects(first: 50) {
              edges {
                node {
                  id
                  name
                }
              }
            }
          }
        }
      }
    `);

  type FormValues = {
    name: string;
    description: string;
    gradientPreset: string;
  };

  const { control, handleSubmit } = useForm<FormValues>({
    defaultValues: { name: "", description: "", gradientPreset: "blue-purple" },
  });

  const onSubmit = useCallback(
    (data: FormValues, close: () => void) => {
      const preset = GRADIENT_PRESETS.find((p) => p.id === data.gradientPreset);
      commit({
        variables: {
          input: {
            name: data.name,
            description: data.description || undefined,
            gradientStartColor: preset?.startColor,
            gradientEndColor: preset?.endColor,
          },
        },
        onCompleted: (response) => {
          const createdProject = response.createProject.project;
          notifySuccess({
            title: "Project created",
            message: `Project "${createdProject.name}" has been successfully created.`,
          });
          onProjectCreated();
          close();
          navigate(`/projects/${createdProject.id}`);
        },
        onError: (error) => {
          const formattedError = getErrorMessagesFromRelayMutationError(error);
          setError(formattedError?.[0] ?? error.message);
        },
      });
    },
    [commit, notifySuccess, navigate, onProjectCreated]
  );

  return (
    <Dialog>
      {({ close }) => (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogTitleExtra>
              <DialogCloseButton close={close} />
            </DialogTitleExtra>
          </DialogHeader>
          <Form onSubmit={handleSubmit((data) => onSubmit(data, close))}>
            <View padding="size-200">
              {error && (
                <Alert variant="danger" banner>
                  {error}
                </Alert>
              )}
              <Flex direction="row" gap="size-200">
                <View flex="1 1 0">
                  <Controller
                    name="name"
                    control={control}
                    rules={{
                      required: "Project name is required",
                      pattern: {
                        value: URI_SAFE_PATTERN,
                        message:
                          "Use only letters, numbers, hyphens, underscores, and dots.",
                      },
                      maxLength: {
                        value: 100,
                        message:
                          "Project name must be less than 100 characters long",
                      },
                    }}
                    render={({
                      field: { onChange, onBlur, value },
                      fieldState: { invalid, error: fieldError },
                    }) => (
                      <TextField
                        isInvalid={invalid}
                        onChange={onChange}
                        onBlur={onBlur}
                        value={value}
                        autoFocus
                      >
                        <Label>Name</Label>
                        <Input placeholder="e.g. customer-feedback" />
                        {fieldError?.message ? (
                          <FieldError>{fieldError.message}</FieldError>
                        ) : (
                          <Text slot="description">
                            URI characters only, max 100 characters
                          </Text>
                        )}
                      </TextField>
                    )}
                  />
                </View>
                <View flex="1 1 0">
                  <Controller
                    name="gradientPreset"
                    control={control}
                    render={({ field: { onChange, value } }) => {
                      return (
                        <Select
                          value={value}
                          onChange={onChange}
                          aria-label="Project color"
                        >
                          <Label>Project color</Label>
                          <Button>
                            <SelectValue />
                            <SelectChevronUpDownIcon />
                          </Button>
                          <Text slot="description">
                            Helps identify your project.
                          </Text>
                          <Popover>
                            <ListBox>
                              {GRADIENT_PRESETS.map((p) => (
                                <SelectItem
                                  key={p.id}
                                  id={p.id}
                                  textValue={p.label}
                                >
                                  <Flex
                                    direction="row"
                                    gap="size-100"
                                    alignItems="center"
                                  >
                                    <GradientCircle
                                      gradientStartColor={p.startColor}
                                      gradientEndColor={p.endColor}
                                      size={16}
                                    />
                                    {p.label}
                                  </Flex>
                                </SelectItem>
                              ))}
                            </ListBox>
                          </Popover>
                        </Select>
                      );
                    }}
                  />
                </View>
              </Flex>
              <Controller
                name="description"
                control={control}
                render={({
                  field: { onChange, onBlur, value },
                  fieldState: { invalid, error: fieldError },
                }) => (
                  <TextField
                    isInvalid={invalid}
                    onChange={onChange}
                    onBlur={onBlur}
                    value={value}
                  >
                    <Label>Description</Label>
                    <TextArea
                      placeholder="e.g. support agent in production"
                      rows={2}
                    />
                    {fieldError?.message && (
                      <FieldError>{fieldError.message}</FieldError>
                    )}
                  </TextField>
                )}
              />
            </View>
            <DialogFooter>
              <Flex direction="row" gap="size-100">
                <Button
                  variant="default"
                  size="M"
                  onPress={close}
                  type="button"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="M"
                  type="submit"
                  isDisabled={isCommitting}
                >
                  {isCommitting ? "Creating..." : "Create"}
                </Button>
              </Flex>
            </DialogFooter>
          </Form>
        </DialogContent>
      )}
    </Dialog>
  );
}
