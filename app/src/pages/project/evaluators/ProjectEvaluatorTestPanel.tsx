import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import invariant from "tiny-invariant";

import {
  Alert,
  Button,
  Card,
  Empty,
  Flex,
  Heading,
  Loading,
  Text,
  View,
} from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";
import { createLLMEvaluatorPayload } from "@phoenix/components/evaluators/utils";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import { usePlaygroundStore } from "@phoenix/contexts/PlaygroundContext";
import { toGqlCredentials } from "@phoenix/pages/playground/playgroundUtils";
import type {
  ProjectEvaluatorTestPanelMutation,
  InlineLLMEvaluatorInput,
} from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorTestPanelMutation.graphql";
import type { ProjectEvaluatorTestPanelQuery } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorTestPanelQuery.graphql";
import { getProjectEvaluatorMappingDiagnostics } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import type { EvaluatorMappingSource } from "@phoenix/types";
import { isStringKeyedObject } from "@phoenix/typeUtils";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

export const ProjectEvaluatorTestPanel = ({
  projectId,
  filterCondition,
  codeEvaluatorId,
}: {
  projectId: string;
  filterCondition: string;
  codeEvaluatorId?: string;
}) => (
  <Suspense fallback={<Loading />}>
    <ProjectEvaluatorTestPanelContent
      projectId={projectId}
      filterCondition={filterCondition}
      codeEvaluatorId={codeEvaluatorId}
    />
  </Suspense>
);

function ProjectEvaluatorTestPanelContent({
  projectId,
  filterCondition,
  codeEvaluatorId,
}: {
  projectId: string;
  filterCondition: string;
  codeEvaluatorId?: string;
}) {
  const data = useLazyLoadQuery<ProjectEvaluatorTestPanelQuery>(
    graphql`
      query ProjectEvaluatorTestPanelQuery(
        $projectId: ID!
        $filterCondition: String
      ) {
        project: node(id: $projectId) {
          ... on Project {
            spans(
              first: 5
              sort: { col: startTime, dir: desc }
              filterCondition: $filterCondition
            ) {
              edges {
                span: node {
                  id
                  name
                  evaluationContext
                }
              }
            }
          }
        }
      }
    `,
    {
      projectId,
      filterCondition: filterCondition.trim() || null,
    },
    { fetchPolicy: "store-and-network" }
  );
  const spans = data.project?.spans?.edges.map(({ span }) => span) ?? [];
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);
  const selectedSpan =
    spans.find(({ id }) => id === selectedSpanId) ?? spans[0] ?? null;
  const evaluatorStore = useEvaluatorStoreInstance();
  const pathMapping = useEvaluatorStore(
    (state) => state.evaluator.inputMapping.pathMapping
  );
  useEffect(() => {
    if (
      selectedSpan &&
      isSpanEvaluatorMappingSource(selectedSpan.evaluationContext)
    ) {
      evaluatorStore
        .getState()
        .setEvaluatorMappingSource(selectedSpan.evaluationContext);
    }
  }, [evaluatorStore, selectedSpan]);

  const diagnostics = useMemo(
    () =>
      getProjectEvaluatorMappingDiagnostics({
        context: selectedSpan?.evaluationContext,
        pathMapping,
      }),
    [pathMapping, selectedSpan?.evaluationContext]
  );

  return (
    <View paddingX="size-200">
      <Flex direction="column" gap="size-200">
        <Flex direction="column" gap="size-50">
          <Heading level={2}>Matched spans</Heading>
          <Text color="text-500">
            Select a recent matching span to inspect bindings and test the
            evaluator.
          </Text>
        </Flex>
        {spans.length ? (
          <Flex direction="column" gap="size-100">
            {spans.map((span) => (
              <Button
                key={span.id}
                variant={span.id === selectedSpan?.id ? "primary" : "default"}
                onPress={() => setSelectedSpanId(span.id)}
              >
                {span.name}
              </Button>
            ))}
          </Flex>
        ) : (
          <Empty message="No recent spans match this scope" />
        )}
        {selectedSpan ? (
          <>
            <Card title="Span evaluation context">
              <JSONBlock
                value={JSON.stringify(selectedSpan.evaluationContext, null, 2)}
                basicSetup={{ lineNumbers: false }}
              />
            </Card>
            {diagnostics.map(({ variable, path, status }) =>
              status === "missing" ? (
                <Alert
                  key={variable}
                  variant="danger"
                  title={`${variable} does not resolve`}
                >
                  The path {path} would fail for this span.
                </Alert>
              ) : status === "unverified" ? (
                <Alert
                  key={variable}
                  variant="warning"
                  title={`${variable} is unverified`}
                >
                  The path {path} uses an expression that is verified by the
                  server when the evaluator runs.
                </Alert>
              ) : null
            )}
            <ProjectEvaluatorPreviewButton codeEvaluatorId={codeEvaluatorId} />
          </>
        ) : null}
      </Flex>
    </View>
  );
}

function isSpanEvaluatorMappingSource(
  value: unknown
): value is EvaluatorMappingSource<"span"> {
  return (
    isStringKeyedObject(value) &&
    isStringKeyedObject(value.input) &&
    isStringKeyedObject(value.output) &&
    isStringKeyedObject(value.metadata)
  );
}

function ProjectEvaluatorPreviewButton({
  codeEvaluatorId,
}: {
  codeEvaluatorId?: string;
}) {
  const evaluatorStore = useEvaluatorStoreInstance();
  const playgroundStore = usePlaygroundStore();
  const credentials = useCredentialsContext((state) => state);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [previewEvaluator, isPending] =
    useMutation<ProjectEvaluatorTestPanelMutation>(graphql`
      mutation ProjectEvaluatorTestPanelMutation($input: EvaluatorPreviewsInput!) {
        evaluatorPreviews(input: $input) {
          results {
            evaluatorName
            annotation {
              name
              label
              score
              explanation
            }
            error
          }
        }
      }
    `);

  const onTest = useCallback(() => {
    setError(null);
    setResult(null);
    const state = evaluatorStore.getState();
    const { instances } = playgroundStore.getState();
    const instanceId = instances[0].id;
    invariant(instanceId != null, "instanceId is required");
    let evaluator:
      | { codeEvaluatorId: string }
      | { inlineLlmEvaluator: InlineLLMEvaluatorInput };
    if (codeEvaluatorId) {
      evaluator = { codeEvaluatorId };
    } else {
      const payload = createLLMEvaluatorPayload({
        playgroundStore,
        instanceId,
        name: state.evaluator.globalName,
        description: state.evaluator.description,
        outputConfigs: state.outputConfigs,
        inputMapping: state.evaluator.inputMapping,
        includeExplanation: state.evaluator.includeExplanation,
        datasetId: "",
      });
      evaluator = {
        inlineLlmEvaluator: {
          name: payload.name,
          description: payload.description,
          outputConfigs: payload.outputConfigs,
          promptVersion: payload.promptVersion,
        },
      };
    }
    previewEvaluator({
      variables: {
        input: {
          previews: [
            {
              context: state.evaluatorMappingSource,
              evaluator,
              inputMapping: state.evaluator.inputMapping,
            },
          ],
          credentials: toGqlCredentials(credentials),
        },
      },
      onCompleted(response, errors) {
        if (errors?.length) {
          setError(errors.map(({ message }) => message).join("\n"));
          return;
        }
        setResult(response.evaluatorPreviews.results);
      },
      onError(mutationError) {
        setError(
          getErrorMessagesFromRelayMutationError(mutationError)?.join("\n") ??
            mutationError.message
        );
      },
    });
  }, [
    codeEvaluatorId,
    credentials,
    evaluatorStore,
    playgroundStore,
    previewEvaluator,
  ]);

  return (
    <Flex direction="column" gap="size-100">
      <Button variant="primary" isPending={isPending} onPress={onTest}>
        Test evaluator
      </Button>
      {error ? (
        <Alert variant="danger" title="Test failed">
          {error}
        </Alert>
      ) : null}
      {result ? (
        <Card title="Evaluator result">
          <JSONBlock
            value={JSON.stringify(result, null, 2)}
            basicSetup={{ lineNumbers: false }}
          />
        </Card>
      ) : null}
    </Flex>
  );
}
