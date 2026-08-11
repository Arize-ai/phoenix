import { css } from "@emotion/react";
import { Suspense } from "react";
import { useLazyLoadQuery } from "react-relay";
import { useNavigate } from "react-router";

import { Flex, Icon, Icons, Skeleton, Text } from "@phoenix/components";
import {
  EmptyState,
  EmptyStateArea,
  EmptyStateGraphic,
} from "@phoenix/components/core/empty";
import { LineClamp } from "@phoenix/components/core/utility/LineClamp";
import { ErrorBoundary } from "@phoenix/components/exception";
import type { projectEvaluatorOptionsQuery } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorOptionsQuery.graphql";
import { projectEvaluatorOptionsQuery as projectEvaluatorOptionsQueryNode } from "@phoenix/pages/project/evaluators/projectEvaluatorOptions";
import { useProjectEvaluatorPaths } from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";

// The Add evaluator menu is the overflow path for the full list.
const MAX_COPY_CARDS = 4;
const MAX_ATTACH_CARDS = 3;

// Two rows of cards, so the header above the gallery stays put while the
// evaluator list resolves.
const SKELETON_ROWS = 2;

/**
 * The zero state for a project with no evaluators: what an evaluator does,
 * then the ways to add one.
 *
 * The layout is the dataset evaluators empty state's -- an {@link EmptyState}
 * over two columns of item cards, LLM on the left and code on the right -- so
 * the two surfaces read as the same thing. What changed from the gallery this
 * replaces is where it sits: it is no longer a `<tbody>` under a table's column
 * headers, and the copy leads rather than trailing the cards.
 */
export function ProjectEvaluatorsEmptyState() {
  return (
    <EmptyStateArea>
      <Flex
        direction="column"
        alignItems="center"
        justifyContent="center"
        gap="size-300"
        width="100%"
        maxWidth="700px"
        margin="var(--global-dimension-size-300) auto"
      >
        <EmptyState
          graphic={<EmptyStateGraphic variant="evaluator" />}
          title="No evaluators for this project"
          description="Add an evaluator to score spans, traces, or sessions automatically as they arrive."
        />
        <ErrorBoundary fallback={GalleryError}>
          <Suspense fallback={<GallerySkeleton />}>
            <Gallery />
          </Suspense>
        </ErrorBoundary>
      </Flex>
    </EmptyStateArea>
  );
}

/**
 * One column per evaluator kind: authoring from scratch at the top, then the
 * evaluators that already exist in this instance as one click each -- LLM
 * evaluators are copied so the project gets its own editable version, code
 * evaluators are attached by reference.
 */
function Gallery() {
  const navigate = useNavigate();
  const paths = useProjectEvaluatorPaths();
  const data = useLazyLoadQuery<projectEvaluatorOptionsQuery>(
    projectEvaluatorOptionsQueryNode,
    {},
    { fetchPolicy: "store-and-network" }
  );
  const evaluators = data.evaluators.edges.map(({ evaluator }) => evaluator);
  const copyEvaluators = evaluators
    .filter((evaluator) => evaluator.__typename === "LLMEvaluator")
    .slice(0, MAX_COPY_CARDS);
  const attachEvaluators = evaluators
    .filter((evaluator) => evaluator.__typename === "CodeEvaluator")
    .slice(0, MAX_ATTACH_CARDS);
  return (
    <Flex direction="row" gap="size-125" width="100%">
      <div css={evaluatorColumnCSS}>
        <button
          css={evaluatorItemButtonCSS}
          onClick={() => navigate(paths.newLlm)}
        >
          <Flex direction="row" alignItems="center" gap="size-50">
            <Icon svg={<Icons.Plus />} />
            <Text size="S" weight="heavy">
              Create new LLM evaluator
            </Text>
          </Flex>
          <LineClamp lines={2}>
            <Text size="XS" color="text-700">
              Author an LLM-as-a-judge evaluator from scratch.
            </Text>
          </LineClamp>
        </button>
        {copyEvaluators.map((evaluator) => (
          <button
            key={evaluator.id}
            css={evaluatorItemButtonCSS}
            onClick={() => navigate(paths.copyLlm(evaluator.id))}
          >
            <Text size="S" weight="heavy">
              Copy {evaluator.name}
            </Text>
            <LineClamp lines={2}>
              <Text size="XS" color="text-700">
                {evaluator.description}
              </Text>
            </LineClamp>
          </button>
        ))}
      </div>
      <div css={evaluatorColumnCSS}>
        <button
          css={evaluatorItemButtonCSS}
          onClick={() => navigate(paths.newCode)}
        >
          <Flex direction="row" alignItems="center" gap="size-50">
            <Icon svg={<Icons.Code />} />
            <Text size="S" weight="heavy">
              Create new code evaluator
            </Text>
          </Flex>
          <LineClamp lines={2}>
            <Text size="XS" color="text-700">
              Author a Python or TypeScript evaluator from scratch.
            </Text>
          </LineClamp>
        </button>
        {attachEvaluators.map((evaluator) => (
          <button
            key={evaluator.id}
            css={evaluatorItemButtonCSS}
            onClick={() => navigate(paths.attachCode(evaluator.id))}
          >
            <Text size="S" weight="heavy">
              Attach {evaluator.name}
            </Text>
            <LineClamp lines={2}>
              <Text size="XS" color="text-700">
                {evaluator.description}
              </Text>
            </LineClamp>
          </button>
        ))}
      </div>
    </Flex>
  );
}

function GallerySkeleton() {
  return (
    <Flex direction="row" gap="size-125" width="100%" aria-hidden="true">
      {Array.from({ length: 2 }, (_, column) => (
        <div key={column} css={evaluatorColumnCSS}>
          {Array.from({ length: SKELETON_ROWS }, (_, row) => (
            <Skeleton key={row} width="100%" height={90} borderRadius="S" />
          ))}
        </div>
      ))}
    </Flex>
  );
}

function GalleryError() {
  return (
    <Text size="S" color="text-500">
      Existing evaluators could not be loaded.
    </Text>
  );
}

const evaluatorItemButtonCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-50);
  height: 90px;
  padding: var(--global-dimension-size-200);
  border-radius: var(--global-rounding-small);
  border: 1px solid var(--global-border-color-default);
  background-color: transparent;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.2s ease;
  &:hover {
    background-color: var(--global-color-gray-200);
  }
`;

const evaluatorColumnCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-125);
  flex: 1;
`;
