import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useNavigate } from "react-router";

import {
  Button,
  ExternalLink,
  ExternalLinkButton,
  Flex,
  Icon,
  Icons,
  Link,
  Text,
  View,
} from "@phoenix/components";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { DatasetSelect } from "@phoenix/components/dataset";
import {
  CREATE_CODE_EVALUATOR_PARAM,
  CREATE_LLM_EVALUATOR_PARAM,
} from "@phoenix/constants/searchParams";
import type { GlobalEvaluatorsEmptyStateQuery } from "@phoenix/pages/evaluators/__generated__/GlobalEvaluatorsEmptyStateQuery.graphql";

const evaluateTracesCardCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-50);
  padding: var(--global-dimension-size-200);
  border-radius: var(--global-rounding-small);
  border: 1px solid var(--global-border-color-default);
  background-color: transparent;
  max-width: 456px;
`;

const checklistCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-300);
  padding: var(--global-dimension-size-300);
  border-radius: var(--global-rounding-small);
  border: 1px solid var(--global-border-color-default);
  width: 100%;
  max-width: 560px;
`;

const stepCSS = css`
  display: flex;
  flex-direction: row;
  gap: var(--global-dimension-size-200);
  align-items: flex-start;
`;

const stepMarkerColumnCSS = css`
  flex: none;
  width: 24px;
  display: flex;
  justify-content: center;
  padding-top: 2px;
`;

const stepMarkerCSS = css`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1px solid var(--global-border-color-default);
  color: var(--global-text-color-700);
  font-size: 12px;
  line-height: 1;
`;

const stepContentCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  min-width: 0;
  flex: 1 1 auto;
`;

const datasetSelectWrapperCSS = css`
  max-width: 320px;
  width: 100%;
`;

/**
 * SVG-based workflow diagram showing the data flow:
 * Dataset (input/reference/metadata) → Task → output → Evaluator → Score
 *
 * This diagram illustrates how evaluators work in the experiment pipeline:
 * 1. Dataset contains examples with input, reference output, and metadata
 * 2. Task (LLM/Agent/App) processes the input and produces output
 * 3. Evaluator scores the output using reference and metadata as context
 */
const WorkflowDiagram = () => {
  // Colors matching the mermaid diagram style
  const colors = {
    dataset: "#e67e22", // orange
    task: "#2196f3", // blue
    evaluator: "#9c27b0", // purple
    output: "#1976d2", // darker blue
    score: "#7b1fa2", // darker purple
    arrow: "var(--global-color-gray-500)",
    dashedArrow: "var(--global-color-gray-400)",
    text: "var(--global-text-color-900)",
    subtext: "var(--global-text-color-700)",
    bg: "var(--global-color-gray-100)",
  };

  return (
    <svg
      width="620"
      height="290"
      viewBox="0 0 620 290"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      css={css`
        max-width: 100%;
        height: auto;
      `}
    >
      {/* Dataset Box */}
      <g>
        <rect
          x="20"
          y="40"
          width="160"
          height="200"
          rx="8"
          fill={colors.bg}
          stroke={colors.dataset}
          strokeWidth="2"
        />
        <text
          x="100"
          y="68"
          textAnchor="middle"
          fill={colors.text}
          fontSize="14"
          fontWeight="600"
        >
          Dataset
        </text>

        {/* Example items inside dataset */}
        <rect
          x="35"
          y="85"
          width="130"
          height="140"
          rx="4"
          fill="var(--global-color-gray-75)"
          stroke={colors.dataset}
          strokeWidth="1"
          strokeOpacity="0.5"
        />
        <text
          x="100"
          y="105"
          textAnchor="middle"
          fill={colors.subtext}
          fontSize="11"
        >
          Example
        </text>

        {/* Input field */}
        <rect
          x="45"
          y="115"
          width="110"
          height="28"
          rx="4"
          fill="var(--global-color-gray-200)"
        />
        <text
          x="100"
          y="134"
          textAnchor="middle"
          fill={colors.text}
          fontSize="11"
        >
          input
        </text>

        {/* Reference field */}
        <rect
          x="45"
          y="150"
          width="110"
          height="28"
          rx="4"
          fill="var(--global-color-gray-200)"
        />
        <text
          x="100"
          y="169"
          textAnchor="middle"
          fill={colors.text}
          fontSize="11"
        >
          reference
        </text>

        {/* Metadata field */}
        <rect
          x="45"
          y="185"
          width="110"
          height="28"
          rx="4"
          fill="var(--global-color-gray-200)"
        />
        <text
          x="100"
          y="204"
          textAnchor="middle"
          fill={colors.text}
          fontSize="11"
        >
          metadata
        </text>
      </g>

      {/* Task Box */}
      <g>
        <rect
          x="250"
          y="80"
          width="120"
          height="70"
          rx="8"
          fill={colors.bg}
          stroke={colors.task}
          strokeWidth="2"
        />
        <text
          x="310"
          y="108"
          textAnchor="middle"
          fill={colors.text}
          fontSize="14"
          fontWeight="600"
        >
          Task
        </text>
        <text
          x="310"
          y="128"
          textAnchor="middle"
          fill={colors.subtext}
          fontSize="11"
        >
          Playground Prompt
        </text>
      </g>

      {/* Output Node */}
      <g>
        <rect
          x="265"
          y="180"
          width="90"
          height="36"
          rx="18"
          fill={colors.bg}
          stroke={colors.output}
          strokeWidth="2"
        />
        <text
          x="310"
          y="203"
          textAnchor="middle"
          fill={colors.text}
          fontSize="12"
          fontWeight="500"
        >
          output
        </text>
      </g>

      {/* Evaluator Box */}
      <g>
        <rect
          x="430"
          y="120"
          width="120"
          height="70"
          rx="8"
          fill={colors.bg}
          stroke={colors.evaluator}
          strokeWidth="2"
        />
        <text
          x="490"
          y="152"
          textAnchor="middle"
          fill={colors.text}
          fontSize="14"
          fontWeight="600"
        >
          Evaluator
        </text>
        <text
          x="490"
          y="172"
          textAnchor="middle"
          fill={colors.subtext}
          fontSize="11"
        >
          LLM or Code
        </text>
      </g>

      {/* Score Node */}
      <g>
        <rect
          x="560"
          y="137"
          width="50"
          height="36"
          rx="18"
          fill={colors.bg}
          stroke={colors.score}
          strokeWidth="2"
        />
        <text
          x="585"
          y="160"
          textAnchor="middle"
          fill={colors.text}
          fontSize="11"
          fontWeight="500"
        >
          Score
        </text>
      </g>

      {/* Arrows */}
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill={colors.arrow} />
        </marker>
        <marker
          id="arrowhead-dashed"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill={colors.dashedArrow} />
        </marker>
      </defs>

      {/* Input → Task (solid): right from input, up, then right to Task */}
      <polyline
        points="155,129 200,129 200,115 248,115"
        stroke={colors.arrow}
        strokeWidth="2"
        fill="none"
        markerEnd="url(#arrowhead)"
      />

      {/* Task → Output (solid): straight down */}
      <line
        x1="310"
        y1="150"
        x2="310"
        y2="178"
        stroke={colors.arrow}
        strokeWidth="2"
        markerEnd="url(#arrowhead)"
      />

      {/* Output → Evaluator (solid): right from output, up, then right to Evaluator */}
      <polyline
        points="355,198 390,198 390,155 428,155"
        stroke={colors.arrow}
        strokeWidth="2"
        fill="none"
        markerEnd="url(#arrowhead)"
      />

      {/* Reference → Evaluator (dashed): right, up above everything, right, down to Evaluator top */}
      <polyline
        points="155,164 195,164 195,55 470,55 470,118"
        stroke={colors.dashedArrow}
        strokeWidth="1.5"
        strokeDasharray="4 3"
        fill="none"
        markerEnd="url(#arrowhead-dashed)"
        css={css`
          @keyframes dashFlow1 {
            to {
              stroke-dashoffset: -14;
            }
          }
          animation: dashFlow1 1.5s linear infinite;
        `}
      />

      {/* Metadata → Evaluator (dashed): right, down below everything, right, up to Evaluator bottom */}
      <polyline
        points="155,199 195,199 195,255 510,255 510,192"
        stroke={colors.dashedArrow}
        strokeWidth="1.5"
        strokeDasharray="4 3"
        fill="none"
        markerEnd="url(#arrowhead-dashed)"
        css={css`
          @keyframes dashFlow2 {
            to {
              stroke-dashoffset: -14;
            }
          }
          animation: dashFlow2 1.5s linear infinite;
        `}
      />

      {/* Evaluator → Score (solid) */}
      <line
        x1="550"
        y1="155"
        x2="558"
        y2="155"
        stroke={colors.arrow}
        strokeWidth="2"
        markerEnd="url(#arrowhead)"
      />
    </svg>
  );
};

export const GlobalEvaluatorsEmptyState = ({
  hasActiveFilter,
}: {
  hasActiveFilter: boolean;
}) => {
  // Filtered empty state - simple message
  if (hasActiveFilter) {
    return (
      <CompactEmptyState
        icon={<Icon svg={<Icons.Scale />} />}
        description="No evaluators"
        isFiltered
      />
    );
  }

  // Unfiltered empty state - actionable quickstart checklist
  return <EvaluatorsQuickstart />;
};

/**
 * A numbered checklist step. Renders a success checkmark in place of the number
 * once `isComplete` is true so users can see their progress at a glance.
 */
const ChecklistStep = ({
  index,
  isComplete,
  title,
  children,
}: {
  index: number;
  isComplete: boolean;
  title: ReactNode;
  children: ReactNode;
}) => {
  return (
    <div css={stepCSS}>
      <div css={stepMarkerColumnCSS}>
        {isComplete ? (
          <Icon color="success" svg={<Icons.CheckmarkCircleFilled />} />
        ) : (
          <div css={stepMarkerCSS}>{index}</div>
        )}
      </div>
      <div css={stepContentCSS}>
        <Text weight="heavy">{title}</Text>
        {children}
      </div>
    </div>
  );
};

/**
 * Actionable onboarding for the global evaluators page. Evaluators can only be
 * created against a dataset, and LLM evaluators additionally require a usable
 * model provider, so this walks the user through: pick a dataset → (for LLM)
 * configure a model provider → add the evaluator on that dataset.
 */
const EvaluatorsQuickstart = () => {
  const navigate = useNavigate();
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(
    null
  );
  const data = useLazyLoadQuery<GlobalEvaluatorsEmptyStateQuery>(
    graphql`
      query GlobalEvaluatorsEmptyStateQuery {
        modelProviders {
          credentialsSet
          credentialRequirements {
            isRequired
          }
        }
      }
    `,
    {},
    // Revalidate against the network on mount so a provider key added elsewhere
    // (e.g. Settings → AI Providers) is reflected without a full page reload.
    { fetchPolicy: "store-and-network" }
  );

  // A real API key is configured only when a provider that actually *requires*
  // credentials has them set. Local providers like Ollama report
  // `credentialsSet: true` with no credential requirements, so they must not
  // mark this step complete.
  const hasApiKey = data.modelProviders.some(
    (provider) =>
      provider.credentialsSet &&
      provider.credentialRequirements.some(
        (requirement) => requirement.isRequired
      )
  );
  // Any provider with credentials set can run LLM evaluators — including
  // credential-less local providers like Ollama.
  const hasUsableModelProvider = data.modelProviders.some(
    (provider) => provider.credentialsSet
  );
  const hasDataset = selectedDatasetId != null;

  const openDatasetEvaluators = (createParam: string) => {
    if (!selectedDatasetId) {
      return;
    }
    void navigate(
      `/datasets/${selectedDatasetId}/evaluators?${createParam}=true`
    );
  };

  return (
    <View
      width="100%"
      paddingY="size-400"
      flex="1 1 auto"
      minHeight={0}
      overflow="auto"
    >
      <Flex
        direction="column"
        width="100%"
        alignItems="center"
        justifyContent="center"
        gap="size-400"
      >
        <Flex
          direction="column"
          justifyContent="center"
          width="100%"
          alignItems="center"
        >
          <Text size="XL" weight="heavy">
            Automate evaluation of your AI outputs
          </Text>

          {/* Workflow diagram */}
          <Flex direction="column" gap="size-100" alignItems="center">
            <Text size="S" color="text-700">
              Evaluators score playground experiment task outputs using dataset
              examples as context
            </Text>
            <WorkflowDiagram />
          </Flex>
        </Flex>

        {/* Actionable setup checklist */}
        <div css={checklistCSS}>
          <Text size="S" color="text-700">
            Evaluators run against a dataset. Follow these steps to create your
            first one.
          </Text>

          <ChecklistStep
            index={1}
            isComplete={hasDataset}
            title="Pick a dataset"
          >
            <Text size="S" color="text-700">
              Choose the dataset you want to add evaluators to.
            </Text>
            <div css={datasetSelectWrapperCSS}>
              <DatasetSelect
                value={selectedDatasetId}
                onChange={setSelectedDatasetId}
                placeholder="Select a dataset"
              />
            </div>
          </ChecklistStep>

          <ChecklistStep
            index={2}
            isComplete={hasApiKey}
            title={
              <Flex direction="row" gap="size-100" alignItems="center">
                <Text weight="heavy">Add a model API key</Text>
                <Text size="XS" color="text-500">
                  for LLM evaluators
                </Text>
              </Flex>
            }
          >
            {hasApiKey ? (
              <Text size="S" color="text-700">
                A model provider API key is configured. You can create LLM
                evaluators.
              </Text>
            ) : (
              <>
                <Text size="S" color="text-700">
                  Add an API key to use hosted models like OpenAI or Anthropic.
                  Local providers such as Ollama need no key. Code evaluators
                  don&apos;t require a model at all — skip this step if you only
                  need code checks.
                </Text>
                <Flex direction="row">
                  <Button
                    size="S"
                    leadingVisual={<Icon svg={<Icons.Key />} />}
                    onClick={() => navigate("/settings/providers")}
                  >
                    Add an API key
                  </Button>
                </Flex>
              </>
            )}
          </ChecklistStep>

          <ChecklistStep index={3} isComplete={false} title="Add an evaluator">
            <Text size="S" color="text-700">
              Create a code or LLM evaluator on your selected dataset.
            </Text>
            <Flex direction="row" gap="size-200" alignItems="center">
              <Button
                variant="primary"
                size="S"
                isDisabled={!hasDataset}
                leadingVisual={<Icon svg={<Icons.Code />} />}
                onClick={() =>
                  openDatasetEvaluators(CREATE_CODE_EVALUATOR_PARAM)
                }
              >
                Code evaluator
              </Button>
              <Button
                variant="primary"
                size="S"
                isDisabled={!hasDataset || !hasUsableModelProvider}
                leadingVisual={<Icon svg={<Icons.LLMOutput />} />}
                onClick={() =>
                  openDatasetEvaluators(CREATE_LLM_EVALUATOR_PARAM)
                }
              >
                LLM evaluator
              </Button>
            </Flex>
            {!hasDataset && (
              <Text size="XS" color="text-500">
                Pick a dataset above to continue.
              </Text>
            )}
            {hasDataset && !hasUsableModelProvider && (
              <Text size="XS" color="text-500">
                Configure a model provider above to enable LLM evaluators.
              </Text>
            )}
          </ChecklistStep>
        </div>

        {/* Documentation */}
        <Flex direction="row" gap="size-200">
          <ExternalLinkButton
            href="https://arize.com/docs/phoenix/evaluation/server-evals/overview"
            target="_blank"
            leadingVisual={<Icon svg={<Icons.Book />} />}
          >
            Documentation
          </ExternalLinkButton>
        </Flex>

        {/* Tracing → evaluation bridge */}
        <div css={evaluateTracesCardCSS}>
          <Flex direction="row" gap="size-100" alignItems="center">
            <Icon svg={<Icons.Trace />} />
            <Text weight="heavy">Evaluate traces in a project</Text>
          </Flex>
          <Text size="S" color="text-700">
            Already tracing? Evals can score production traces too — results are
            logged as annotations and show up in your{" "}
            <Link to="/projects">project&apos;s</Link> annotation score charts.
            See{" "}
            <ExternalLink href="https://arize.com/docs/phoenix/tracing/how-to-tracing/feedback-and-annotations/evaluating-phoenix-traces">
              evaluating traces
            </ExternalLink>{" "}
            to get started.
          </Text>
        </div>
      </Flex>
    </View>
  );
};
