import { useEffect, useState } from "react";
import { graphql, useMutation } from "react-relay";

import { Modal, ModalOverlay } from "@phoenix/components";
import { AnnotationConfigDialog } from "@phoenix/components/annotation/AnnotationConfigDialog";
import { useAgentStore } from "@phoenix/contexts/AgentContext";
import { OPEN_ANNOTATION_CONFIG_FORM_TOOL_NAME } from "@phoenix/agent/tools/annotationConfigDraft/constants";
import { useAdvertiseAgentContext } from "@phoenix/agent/context/useAdvertiseAgentContext";
import type { AnnotationConfig } from "@phoenix/pages/settings/types";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { AnnotationConfigSlideoverCreateMutation } from "./__generated__/AnnotationConfigSlideoverCreateMutation.graphql";
import type { AnnotationConfigSlideoverUpdateMutation } from "./__generated__/AnnotationConfigSlideoverUpdateMutation.graphql";
import type { AnnotationConfigSlideoverAddToProjectMutation } from "./__generated__/AnnotationConfigSlideoverAddToProjectMutation.graphql";

/** The form's open state: create (no config) or edit (seeded with a config). */
type AnnotationConfigFormState = {
  mode: "create" | "edit";
  config?: AnnotationConfig;
};

/**
 * Shape the discriminated config into the GraphQL `AnnotationConfigInput`. The
 * `AnnotationConfig` type is derived from a GraphQL fragment and so types these
 * fields loosely; the values are well-formed by construction (the form's store
 * always sets them), so the nullish fallbacks only satisfy the compiler.
 */
const buildAnnotationConfigInput = (config: AnnotationConfig) => {
  switch (config.annotationType) {
    case "CATEGORICAL":
      return {
        categorical: {
          name: config.name,
          description: config.description,
          optimizationDirection: config.optimizationDirection ?? "MAXIMIZE",
          values: (config.values ?? []).map((value) => ({
            label: value.label,
            score: value.score ?? null,
          })),
        },
      };
    case "CONTINUOUS":
      return {
        continuous: {
          name: config.name,
          description: config.description,
          optimizationDirection: config.optimizationDirection ?? "MAXIMIZE",
          lowerBound: config.lowerBound,
          upperBound: config.upperBound,
        },
      };
    case "FREEFORM":
      return {
        freeform: {
          name: config.name,
          description: config.description,
        },
      };
  }
};

/**
 * Hosts the annotation-config create/edit form as a project-scoped slideover.
 *
 * Self-contained: it owns its open state, registers the PXI
 * `open_annotation_config_form` client action so the agent can open it while a
 * project is focused, advertises the `annotation_config` context while open
 * (which gates the read/edit draft tools), and owns the create / update /
 * project-association mutations. Newly created configs are attached to the
 * current project.
 */
export const AnnotationConfigSlideover = ({
  projectId,
}: {
  /** Relay node id of the focused project. */
  projectId: string;
}) => {
  const agentStore = useAgentStore();
  const [formState, setFormState] = useState<AnnotationConfigFormState | null>(
    null
  );

  // Advertise the form context only while open so the read/edit draft tools
  // are gated to the open dialog; null clears the advertisement when closed.
  useAdvertiseAgentContext(
    formState
      ? {
          type: "annotation_config",
          annotationConfigNodeId: formState.config?.id ?? null,
        }
      : null
  );

  // Register the open client action for the lifetime of the project page. The
  // agent's open tool dispatches here; today it opens the create form.
  useEffect(() => {
    const { registerClientAction, unregisterClientAction } =
      agentStore.getState();
    registerClientAction(OPEN_ANNOTATION_CONFIG_FORM_TOOL_NAME, async () => {
      setFormState({ mode: "create" });
      return { ok: true, output: "Annotation-config form opened." };
    });
    return () => unregisterClientAction(OPEN_ANNOTATION_CONFIG_FORM_TOOL_NAME);
  }, [agentStore]);

  const [createConfig] =
    useMutation<AnnotationConfigSlideoverCreateMutation>(graphql`
      mutation AnnotationConfigSlideoverCreateMutation(
        $input: CreateAnnotationConfigInput!
      ) {
        createAnnotationConfig(input: $input) {
          annotationConfig {
            ... on Node {
              id
            }
          }
        }
      }
    `);

  const [updateConfig] =
    useMutation<AnnotationConfigSlideoverUpdateMutation>(graphql`
      mutation AnnotationConfigSlideoverUpdateMutation(
        $input: UpdateAnnotationConfigInput!
      ) {
        updateAnnotationConfig(input: $input) {
          query {
            ...AnnotationConfigTableFragment
          }
        }
      }
    `);

  const [addConfigToProject] =
    useMutation<AnnotationConfigSlideoverAddToProjectMutation>(graphql`
      mutation AnnotationConfigSlideoverAddToProjectMutation(
        $projectId: ID!
        $annotationConfigId: ID!
      ) {
        addAnnotationConfigToProject(
          input: {
            projectId: $projectId
            annotationConfigId: $annotationConfigId
          }
        ) {
          query {
            node(id: $projectId) {
              ... on Project {
                id
              }
            }
          }
        }
      }
    `);

  const handleSubmit = (
    config: AnnotationConfig,
    {
      onCompleted,
      onError,
    }: { onCompleted?: () => void; onError?: (error: string) => void } = {}
  ) => {
    const reportError = (error: Error) => {
      const messages = getErrorMessagesFromRelayMutationError(error);
      onError?.(messages?.[0] ?? "Failed to save annotation config");
    };
    const annotationConfig = buildAnnotationConfigInput(config);
    if (formState?.mode === "edit") {
      updateConfig({
        variables: { input: { id: config.id ?? "", annotationConfig } },
        onCompleted: () => onCompleted?.(),
        onError: reportError,
      });
      return;
    }
    // Create, then attach the new config to the current project.
    createConfig({
      variables: { input: { annotationConfig } },
      onCompleted: (response) => {
        const annotationConfigId =
          response.createAnnotationConfig.annotationConfig.id;
        if (annotationConfigId == null) {
          onError?.("Created annotation config is missing an id");
          return;
        }
        addConfigToProject({
          variables: { projectId, annotationConfigId },
          onCompleted: () => onCompleted?.(),
          onError: reportError,
        });
      },
      onError: reportError,
    });
  };

  return (
    <ModalOverlay
      isOpen={formState != null}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setFormState(null);
        }
      }}
    >
      <Modal variant="slideover" size="L">
        <AnnotationConfigDialog
          initialAnnotationConfig={formState?.config}
          onAddAnnotationConfig={handleSubmit}
        />
      </Modal>
    </ModalOverlay>
  );
};
