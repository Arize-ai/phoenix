import { css } from "@emotion/react";
import { Suspense, useEffect, useEffectEvent, useState } from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import invariant from "tiny-invariant";

import {
  Alert,
  Button,
  Empty,
  Flex,
  Heading,
  Icon,
  Icons,
  Loading,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
} from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";
import { useTimeRange } from "@phoenix/components/datetime";
import {
  buildOutputConfigsInput,
  createLLMEvaluatorPayload,
} from "@phoenix/components/evaluators/utils";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import { usePlaygroundStore } from "@phoenix/contexts/PlaygroundContext";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { toGqlCredentials } from "@phoenix/pages/playground/playgroundUtils";
import type {
  ProjectEvaluatorTestPanelMutation,
  InlineCodeEvaluatorInput,
  InlineLLMEvaluatorInput,
} from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorTestPanelMutation.graphql";
import type { ProjectEvaluatorTestPanelQuery } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorTestPanelQuery.graphql";
import { getProjectEvaluatorMappingDiagnostics } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import type {
  CodeEvaluatorLanguage,
  EvaluatorMappingSource,
} from "@phoenix/types";
import { isStringKeyedObject } from "@phoenix/typeUtils";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

/**
 * The unsaved source code being authored, used to preview a not-yet-created
 * code evaluator via the inline-code preview path.
 */
export type ProjectEvaluatorInlineCode = {
  language: CodeEvaluatorLanguage;
  sourceCode: string;
  sandboxConfigId: string | null;
};

/**
 * The right-panel live preview for a project evaluator: recent matching spans
 * to pick from, the selected span's evaluation context and binding
 * diagnostics as tabs, and an always-reachable test action pinned to the
 * bottom of the panel.
 */
export const ProjectEvaluatorTestPanel = ({
  projectId,
  filterCondition,
  codeEvaluatorId,
  inlineCode,
}: {
  projectId: string;
  filterCondition: string;
  codeEvaluatorId?: string;
  inlineCode?: ProjectEvaluatorInlineCode;
}) => (
  <Suspense fallback={<Loading />}>
    <ProjectEvaluatorTestPanelContent
      projectId={projectId}
      filterCondition={filterCondition}
      codeEvaluatorId={codeEvaluatorId}
      inlineCode={inlineCode}
    />
  </Suspense>
);

function ProjectEvaluatorTestPanelContent({
  projectId,
  filterCondition,
  codeEvaluatorId,
  inlineCode,
}: {
  projectId: string;
  filterCondition: string;
  codeEvaluatorId?: string;
  inlineCode?: ProjectEvaluatorInlineCode;
}) {
  // Match the preview to the page's selected time range so it agrees with the
  // adjacent tabs — unless the user explicitly widens to all time because
  // nothing matched.
  const { timeRange } = useTimeRange();
  const [searchAllTime, setSearchAllTime] = useState(false);
  const { shortDateTimeFormatter } = useTimeFormatters();
  const data = useLazyLoadQuery<ProjectEvaluatorTestPanelQuery>(
    graphql`
      query ProjectEvaluatorTestPanelQuery(
        $projectId: ID!
        $filterCondition: String
        $timeRange: TimeRange
      ) {
        project: node(id: $projectId) {
          ... on Project {
            spans(
              first: 5
              sort: { col: startTime, dir: desc }
              filterCondition: $filterCondition
              timeRange: $timeRange
            ) {
              edges {
                span: node {
                  id
                  name
                  startTime
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
      timeRange: searchAllTime
        ? null
        : {
            start: timeRange?.start?.toISOString(),
            end: timeRange?.end?.toISOString(),
          },
    },
    { fetchPolicy: "store-and-network" }
  );
  const spans = data.project?.spans?.edges.map(({ span }) => span) ?? [];
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);
  const selectedSpan =
    spans.find(({ id }) => id === selectedSpanId) ?? spans[0] ?? null;
  const activeContext = selectedSpan?.evaluationContext;
  const evaluatorStore = useEvaluatorStoreInstance();
  const pathMapping = useEvaluatorStore(
    (state) => state.evaluator.inputMapping.pathMapping
  );
  // `selectedSpan` is a fresh object every render (rebuilt from the query's
  // edges), so keying this sync on its identity would rewrite the store each
  // render. Key on the resolved span id (a primitive) and read the context
  // through an effect event so the mapping source is pushed only when the
  // active context actually changes.
  const resolvedSpanId = selectedSpan?.id ?? null;
  const syncMappingSource = useEffectEvent(() => {
    if (activeContext && isSpanEvaluatorMappingSource(activeContext)) {
      evaluatorStore.getState().setEvaluatorMappingSource(activeContext);
    }
  });
  useEffect(() => {
    syncMappingSource();
  }, [resolvedSpanId]);

  const diagnostics = getProjectEvaluatorMappingDiagnostics({
    context: activeContext,
    pathMapping,
  });
  const problemCount = diagnostics.filter(
    ({ status }) => status !== "resolved"
  ).length;

  return (
    <div css={panelCSS}>
      <div css={panelScrollCSS}>
        <Flex direction="row" alignItems="baseline" gap="size-100">
          <Heading level={2}>Live preview</Heading>
          <span
            css={css`
              margin-left: auto;
              display: inline-flex;
              align-items: baseline;
              gap: var(--global-dimension-size-75);
            `}
          >
            <Text size="XS" color="text-500">
              {searchAllTime
                ? "Searching all time"
                : "Matching the page time range"}
            </Text>
            {!searchAllTime ? (
              <Button
                size="S"
                variant="quiet"
                onPress={() => setSearchAllTime(true)}
              >
                Widen
              </Button>
            ) : null}
          </span>
        </Flex>
        {spans.length ? (
          <div role="listbox" aria-label="Recent matching spans" css={rowsCSS}>
            {spans.map((span) => {
              const isSelected = span.id === selectedSpan?.id;
              return (
                <button
                  key={span.id}
                  role="option"
                  aria-selected={isSelected}
                  data-selected={isSelected}
                  css={rowCSS}
                  onClick={() => setSelectedSpanId(span.id)}
                >
                  <span className="span-row__name">{span.name}</span>
                  <span className="span-row__snippet">
                    {getContextSnippet(span.evaluationContext)}
                  </span>
                  <span className="span-row__time">
                    {shortDateTimeFormatter(new Date(span.startTime))}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <Empty
            message={
              searchAllTime
                ? "No spans match this scope"
                : "No spans match this scope in the page time range"
            }
          />
        )}
        {activeContext != null ? (
          <Tabs defaultSelectedKey="context">
            <TabList>
              <Tab id="context">Context</Tab>
              <Tab id="bindings">
                <Flex direction="row" alignItems="center" gap="size-75">
                  Bindings
                  <Text
                    size="XS"
                    color={problemCount === 0 ? "success" : "danger"}
                  >
                    {problemCount === 0
                      ? "✓"
                      : `${problemCount} issue${problemCount === 1 ? "" : "s"}`}
                  </Text>
                </Flex>
              </Tab>
            </TabList>
            <TabPanel id="context">
              <div css={contextViewerCSS}>
                <JSONBlock
                  value={JSON.stringify(activeContext, null, 2)}
                  basicSetup={{ lineNumbers: false }}
                />
              </div>
            </TabPanel>
            <TabPanel id="bindings">
              <BindingDiagnostics
                diagnostics={diagnostics}
                hasExplicitMappings={Object.keys(pathMapping).length > 0}
              />
            </TabPanel>
          </Tabs>
        ) : null}
      </div>
      {activeContext != null ? (
        <ProjectEvaluatorTestBar
          codeEvaluatorId={codeEvaluatorId}
          inlineCode={inlineCode}
          spanContext={activeContext}
        />
      ) : null}
    </div>
  );
}

const panelCSS = css`
  display: flex;
  flex-direction: column;
  min-height: 100%;
`;

const panelScrollCSS = css`
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-150);
  padding: 0 var(--global-dimension-size-200);
`;

const rowsCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-25);
`;

const rowCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  padding: var(--global-dimension-size-75) var(--global-dimension-size-100);
  border-radius: var(--global-rounding-small);
  border: 1px solid transparent;
  background: none;
  cursor: pointer;
  text-align: left;
  min-width: 0;
  color: var(--global-text-color-700);
  &:hover {
    background-color: rgba(var(--global-color-gray-500-rgb), 0.15);
  }
  &[data-selected="true"] {
    background-color: var(--global-color-gray-200);
    border-color: var(--global-border-color-default);
    color: var(--global-text-color-900);
  }
  &:focus-visible {
    outline: 2px solid var(--global-color-info);
    outline-offset: 1px;
  }
  .span-row__name {
    font-family: var(--global-font-family-code, monospace);
    font-size: var(--global-font-size-xs);
    font-weight: 600;
    flex: none;
  }
  .span-row__snippet {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--global-font-size-xs);
    color: var(--global-text-color-500);
  }
  .span-row__time {
    flex: none;
    font-variant-numeric: tabular-nums;
    font-size: var(--global-font-size-xs);
    color: var(--global-text-color-500);
  }
`;

const contextViewerCSS = css`
  margin-top: var(--global-dimension-size-100);
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-small);
  /* Cap the editor and scroll inside CodeMirror so long contexts virtualize
     instead of rendering hundreds of thousands of pixels of DOM. */
  .cm-editor {
    max-height: 400px;
  }
  .cm-scroller {
    overflow: auto;
  }
`;

const testBarCSS = css`
  position: sticky;
  bottom: 0;
  flex: none;
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  padding: var(--global-dimension-size-150) var(--global-dimension-size-200);
  border-top: 1px solid var(--global-border-color-default);
  background-color: var(--global-background-color-default);
`;

/**
 * Extracts a one-line preview of a span's evaluation-context input so
 * same-named spans in the picker are distinguishable at a glance.
 */
function getContextSnippet(context: unknown): string {
  if (!isStringKeyedObject(context)) {
    return "";
  }
  const input = context.input;
  const text =
    typeof input === "string"
      ? input
      : input != null
        ? JSON.stringify(input)
        : "";
  return text.replace(/\s+/g, " ").trim().slice(0, 140);
}

function BindingDiagnostics({
  diagnostics,
  hasExplicitMappings,
}: {
  diagnostics: ReturnType<typeof getProjectEvaluatorMappingDiagnostics>;
  hasExplicitMappings: boolean;
}) {
  if (!hasExplicitMappings) {
    return (
      <Flex direction="column" gap="size-100" marginTop="size-100">
        <Text size="S" color="text-700">
          input, output, and metadata bind automatically from the span context —
          there are no explicit mappings to check.
        </Text>
      </Flex>
    );
  }
  return (
    <Flex direction="column" gap="size-100" marginTop="size-100">
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
            The path {path} uses an expression that is verified by the server
            when the evaluator runs.
          </Alert>
        ) : (
          <Flex
            key={variable}
            direction="row"
            gap="size-100"
            alignItems="center"
          >
            <Icon svg={<Icons.CheckmarkCircle />} color="success" />
            <Text size="S" color="text-700">
              {variable} resolves from {path}
            </Text>
          </Flex>
        )
      )}
    </Flex>
  );
}

function isSpanEvaluatorMappingSource(
  value: unknown
): value is EvaluatorMappingSource<"span"> {
  // `input`/`output` are raw attribute values (string, null, object, ...);
  // only `metadata` is guaranteed to be an object by the server context shape.
  return isStringKeyedObject(value) && isStringKeyedObject(value.metadata);
}

function ProjectEvaluatorTestBar({
  codeEvaluatorId,
  inlineCode,
  spanContext,
}: {
  codeEvaluatorId?: string;
  inlineCode?: ProjectEvaluatorInlineCode;
  spanContext: unknown;
}) {
  const evaluatorStore = useEvaluatorStoreInstance();
  const playgroundStore = usePlaygroundStore();
  const credentials = useCredentialsContext((state) => state);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [previewEvaluator, isPending] =
    useMutation<ProjectEvaluatorTestPanelMutation>(graphql`
      mutation ProjectEvaluatorTestPanelMutation(
        $input: EvaluatorPreviewsInput!
      ) {
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

  const onTest = () => {
    setError(null);
    setResults(null);
    const state = evaluatorStore.getState();
    const { instances } = playgroundStore.getState();
    const instance = instances[0];
    invariant(instance != null, "a playground instance is required");
    const instanceId = instance.id;
    invariant(instanceId != null, "instanceId is required");
    let evaluator:
      | { codeEvaluatorId: string }
      | { inlineCodeEvaluator: InlineCodeEvaluatorInput }
      | { inlineLlmEvaluator: InlineLLMEvaluatorInput };
    if (codeEvaluatorId) {
      evaluator = { codeEvaluatorId };
    } else if (inlineCode) {
      evaluator = {
        inlineCodeEvaluator: {
          name: state.evaluator.globalName,
          language: inlineCode.language,
          sourceCode: inlineCode.sourceCode,
          outputConfigs: buildOutputConfigsInput(state.outputConfigs),
          sandboxConfigId: inlineCode.sandboxConfigId,
          description: state.evaluator.description || null,
        },
      };
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
              context: spanContext,
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
        setResults([...response.evaluatorPreviews.results]);
      },
      onError(mutationError) {
        setError(
          getErrorMessagesFromRelayMutationError(mutationError)?.join("\n") ??
            mutationError.message
        );
      },
    });
  };

  return (
    <div css={testBarCSS}>
      <Flex direction="row" alignItems="center" gap="size-150">
        <Button variant="primary" isPending={isPending} onPress={onTest}>
          Test on selected span
        </Button>
        {results?.map((result, index) =>
          result.error ? null : (
            <TestResultSummary key={index} result={result} />
          )
        )}
      </Flex>
      {error ? (
        <Alert variant="danger" title="Test failed">
          {error}
        </Alert>
      ) : null}
      {results
        ?.filter((result) => result.error)
        .map((result, index) => (
          <Alert
            key={index}
            variant="danger"
            title={`${result.evaluatorName} failed`}
          >
            {result.error}
          </Alert>
        ))}
    </div>
  );
}

type TestResult = {
  readonly evaluatorName: string;
  readonly annotation: {
    readonly name: string;
    readonly label: string | null;
    readonly score: number | null;
    readonly explanation: string | null;
  } | null;
  readonly error: string | null;
};

function TestResultSummary({ result }: { result: TestResult }) {
  const { annotation } = result;
  if (!annotation) {
    return null;
  }
  const valueParts = [
    annotation.label,
    annotation.score != null ? annotation.score.toLocaleString() : null,
  ].filter((part): part is string => part != null);
  return (
    <Flex
      direction="row"
      alignItems="center"
      gap="size-100"
      minWidth={0}
      flex="1 1 auto"
    >
      <span css={resultBadgeCSS}>
        {annotation.name}
        {valueParts.length ? ` · ${valueParts.join(" · ")}` : ""}
      </span>
      {annotation.explanation ? (
        <Text
          size="XS"
          color="text-500"
          title={annotation.explanation}
          css={css`
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          `}
        >
          {annotation.explanation}
        </Text>
      ) : null}
    </Flex>
  );
}

const resultBadgeCSS = css`
  flex: none;
  font-family: var(--global-font-family-code, monospace);
  font-size: var(--global-font-size-xs);
  font-weight: 600;
  color: var(--global-color-success);
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-small);
  padding: var(--global-dimension-size-25) var(--global-dimension-size-100);
`;
