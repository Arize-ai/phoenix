import { css } from "@emotion/react";
import type { ReactNode } from "react";
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

// Cards are a fixed height so a description that runs long cannot make one card
// taller than its neighbour, and so the skeleton can match them.
const CARD_HEIGHT = 90;

/**
 * The zero state for a project with no evaluators: what an evaluator does,
 * then the ways to add one.
 *
 * The layout is the dataset evaluators empty state's -- an {@link EmptyState}
 * over two columns of item cards, LLM on the left and code on the right -- so
 * the two surfaces read as the same thing.
 */
export function ProjectEvaluatorsEmptyState() {
  return (
    <EmptyStateArea>
      {/* EmptyStateArea already centers and offsets this block; the width cap
          is what keeps the two columns from stretching on a wide viewport. */}
      <Flex
        direction="column"
        gap="size-300"
        width="100%"
        maxWidth="700px"
        marginTop="var(--global-dimension-size-300)"
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
        <EvaluatorCard
          icon={<Icon svg={<Icons.Plus />} />}
          title="Create new LLM evaluator"
          description="Author an LLM-as-a-judge evaluator from scratch."
          onPress={() => navigate(paths.newLlm)}
        />
        {copyEvaluators.map((evaluator) => (
          <EvaluatorCard
            key={evaluator.id}
            title={`Copy ${evaluator.name}`}
            description={evaluator.description}
            onPress={() => navigate(paths.copyLlm(evaluator.id))}
          />
        ))}
      </div>
      <div css={evaluatorColumnCSS}>
        <EvaluatorCard
          icon={<Icon svg={<Icons.Code />} />}
          title="Create new code evaluator"
          description="Author a Python or TypeScript evaluator from scratch."
          onPress={() => navigate(paths.newCode)}
        />
        {attachEvaluators.map((evaluator) => (
          <EvaluatorCard
            key={evaluator.id}
            title={`Attach ${evaluator.name}`}
            description={evaluator.description}
            onPress={() => navigate(paths.attachCode(evaluator.id))}
          />
        ))}
      </div>
    </Flex>
  );
}

function EvaluatorCard({
  icon,
  title,
  description,
  onPress,
}: {
  icon?: ReactNode;
  title: string;
  description: ReactNode;
  onPress: () => void;
}) {
  return (
    <button css={evaluatorItemButtonCSS} onClick={onPress}>
      <Flex direction="row" alignItems="center" gap="size-50">
        {icon}
        <Text size="S" weight="heavy">
          {title}
        </Text>
      </Flex>
      <LineClamp lines={2}>
        <Text size="XS" color="text-700">
          {description}
        </Text>
      </LineClamp>
    </button>
  );
}

function GallerySkeleton() {
  const column = (
    <div css={evaluatorColumnCSS}>
      <Skeleton height={CARD_HEIGHT} />
      <Skeleton height={CARD_HEIGHT} />
    </div>
  );
  return (
    <Flex direction="row" gap="size-125" width="100%" aria-hidden="true">
      {column}
      {column}
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
  height: ${CARD_HEIGHT}px;
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
