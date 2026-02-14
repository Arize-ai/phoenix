import { useNavigate } from "react-router";
import { css } from "@emotion/react";

import {
  Button,
  ExternalLinkButton,
  Flex,
  Icon,
  Icons,
  Text,
  View,
} from "@phoenix/components";

const evaluatorTypeCardCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-50);
  padding: var(--global-dimension-size-200);
  border-radius: var(--global-rounding-small);
  border: 1px solid var(--global-border-color-default);
  background-color: transparent;
  width: 220px;
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
    arrow: "var(--global-color-grey-500)",
    dashedArrow: "var(--global-color-grey-400)",
    text: "var(--global-text-color-900)",
    subtext: "var(--global-text-color-700)",
    bg: "var(--global-color-grey-100)",
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
          fill="var(--global-color-grey-75)"
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
          fill="var(--global-color-grey-200)"
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
          fill="var(--global-color-grey-200)"
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
          fill="var(--global-color-grey-200)"
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
  const navigate = useNavigate();

  // Filtered empty state - simple message
  if (hasActiveFilter) {
    return (
      <View width="100%" paddingY="size-400">
        <Flex
          direction="column"
          width="100%"
          alignItems="center"
          justifyContent="center"
        >
          <Text size="S" fontStyle="italic" color="text-700">
            No evaluators found that match the given filter.
          </Text>
        </Flex>
      </View>
    );
  }

  // Unfiltered empty state - full quickstart
  return (
    <View width="100%" paddingY="size-400">
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

        {/* Evaluator type cards */}
        <Flex direction="column" gap="size-200" alignItems="center">
          <Text size="S" color="text-700">
            Get started with your first evaluator by creating a dataset and
            adding evaluators to it.
          </Text>
          <Flex direction="row" gap="size-200">
            <div css={evaluatorTypeCardCSS}>
              <Flex direction="row" gap="size-100" alignItems="center">
                <Icon svg={<Icons.Robot />} />
                <Text weight="heavy">LLM Evaluators</Text>
              </Flex>
              <Text size="S" color="text-700">
                Use AI to assess correctness, relevance, and tone
              </Text>
            </div>
            <div css={evaluatorTypeCardCSS}>
              <Flex direction="row" gap="size-100" alignItems="center">
                <Icon svg={<Icons.Code />} />
                <Text weight="heavy">Code Evaluators</Text>
              </Flex>
              <Text size="S" color="text-700">
                Deterministic checks like exact_match, contains, and regex
              </Text>
            </div>
          </Flex>
        </Flex>

        {/* CTAs */}
        <Flex direction="row" gap="size-200">
          <Button
            variant="primary"
            onClick={() => {
              navigate("/datasets");
            }}
          >
            View Datasets
          </Button>
          <ExternalLinkButton
            href="https://arize.com/docs/phoenix/evaluation/server-side-evaluation"
            target="_blank"
            leadingVisual={<Icon svg={<Icons.BookOutline />} />}
          >
            Documentation
          </ExternalLinkButton>
        </Flex>
      </Flex>
    </View>
  );
};
