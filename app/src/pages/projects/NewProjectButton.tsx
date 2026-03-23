import { css } from "@emotion/react";
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
  ExternalLink,
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
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
  TextArea,
  TextField,
  View,
} from "@phoenix/components";
import { SelectChevronUpDownIcon } from "@phoenix/components/core/icon";
import { GradientCircle } from "@phoenix/components/project/GradientCircle";
import { TypeScriptProjectGuide } from "@phoenix/components/project/TypeScriptProjectGuide";
import { usePreferencesContext } from "@phoenix/contexts";
import { useNotifySuccess } from "@phoenix/contexts";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";
import { ManualProjectGuide } from "@phoenix/pages/projects/ManualProjectGuide";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import { PythonProjectGuide } from "../../components/project/PythonProjectGuide";
import type { NewProjectButtonCreateProjectMutation } from "./__generated__/NewProjectButtonCreateProjectMutation.graphql";
import { GRADIENT_PRESETS, URI_SAFE_PATTERN } from "./ProjectForm";

type NewProjectButtonProps = {
  variant?: ButtonProps["variant"];
  refetchProjects: () => void;
};
const PHOENIX_OTEL_DOC_LINK =
  "https://arize.com/docs/phoenix/tracing/how-to-tracing/setup-tracing";

function TraceBasedProjectGuideIntro() {
  return (
    <Text>
      Projects are created when you log your first trace via OpenTelemetry. See
      the{" "}
      <ExternalLink href={PHOENIX_OTEL_DOC_LINK}>documentation</ExternalLink>{" "}
      for a complete guide.
    </Text>
  );
}
export function NewProjectButton({
  variant,
  refetchProjects,
}: NewProjectButtonProps) {
  const isOnboardingEnabled = useFeatureFlag("tracing-onboarding");

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
        {isOnboardingEnabled ? (
          <ModalOverlay>
            <Modal>
              <NewProjectDialog refetchProjects={refetchProjects} />
            </Modal>
          </ModalOverlay>
        ) : (
          <ModalOverlay>
            <Modal
              variant="slideover"
              size="L"
              css={css`
                width: 70vw !important;
              `}
            >
              <NewProjectDialogWithOnboarding
                refetchProjects={refetchProjects}
              />
            </Modal>
          </ModalOverlay>
        )}
      </DialogTrigger>
    </div>
  );
}

function NewProjectDialog({
  refetchProjects,
}: {
  refetchProjects: () => void;
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
          refetchProjects();
          close();
          navigate(`/projects/${createdProject.id}`);
        },
        onError: (error) => {
          const formattedError = getErrorMessagesFromRelayMutationError(error);
          setError(formattedError?.[0] ?? error.message);
        },
      });
    },
    [commit, notifySuccess, navigate, refetchProjects]
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
                        <Input placeholder="e.g. Customer feedback" />
                        {fieldError?.message ? (
                          <FieldError>{fieldError.message}</FieldError>
                        ) : (
                          <Text slot="description">URI characters only</Text>
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
                      placeholder="e.g. Data for sentiment analysis"
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

function NewProjectDialogWithOnboarding({
  refetchProjects,
}: {
  refetchProjects: () => void;
}) {
  const programmingLanguage = usePreferencesContext(
    (state) => state.programmingLanguage
  );
  const defaultTab = programmingLanguage;

  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a New Project</DialogTitle>
          <DialogTitleExtra>
            <DialogCloseButton slot="close" />
          </DialogTitleExtra>
        </DialogHeader>
        <Tabs defaultSelectedKey={defaultTab}>
          <TabList>
            <Tab id="Python">Python</Tab>
            <Tab id="TypeScript">TypeScript</Tab>
            <Tab id="manual">Manual</Tab>
          </TabList>
          <TabPanel id="Python">
            <View padding="size-200" overflow="auto">
              <TraceBasedProjectGuideIntro />
              <PythonProjectGuide />
            </View>
          </TabPanel>
          <TabPanel id="TypeScript">
            <View padding="size-200" overflow="auto">
              <TraceBasedProjectGuideIntro />
              <TypeScriptProjectGuide />
            </View>
          </TabPanel>
          <TabPanel id="manual">
            <View padding="size-200" overflow="auto">
              <ManualProjectGuide refetchProjects={refetchProjects} />
            </View>
          </TabPanel>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
