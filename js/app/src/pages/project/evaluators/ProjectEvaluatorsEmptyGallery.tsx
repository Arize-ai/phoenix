import { css } from "@emotion/react";
import { Suspense, useState } from "react";
import { useLazyLoadQuery, useRelayEnvironment } from "react-relay";

import { Alert, Flex, Icon, Icons, Loading, Text } from "@phoenix/components";
import { LineClamp } from "@phoenix/components/core/utility/LineClamp";
import { TableEmptyWrap } from "@phoenix/components/table/TableEmptyWrap";
import type { projectEvaluatorOptionsQuery } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorOptionsQuery.graphql";
import {
  CreateProjectEvaluatorSlideover,
  type ProjectEvaluatorCreationMode,
} from "@phoenix/pages/project/evaluators/CreateProjectEvaluatorSlideover";
import {
  buildAttachCodeCreationMode,
  buildCopyLlmCreationMode,
  fetchProjectEvaluatorDetails,
  isCodeProjectEvaluatorDetails,
  isLlmProjectEvaluatorDetails,
  projectEvaluatorOptionsQuery as projectEvaluatorOptionsQueryNode,
  UNSUPPORTED_PROMPT_TEMPLATE_ERROR,
} from "@phoenix/pages/project/evaluators/projectEvaluatorOptions";

// The Add evaluator menu is the overflow path for the full list.
const MAX_COPY_CARDS = 4;
const MAX_ATTACH_CARDS = 3;

export function ProjectEvaluatorsEmptyGallery({
  projectId,
}: {
  projectId: string;
}) {
  return (
    <TableEmptyWrap>
      <Suspense fallback={<Loading />}>
        <Gallery projectId={projectId} />
      </Suspense>
    </TableEmptyWrap>
  );
}

function Gallery({ projectId }: { projectId: string }) {
  const [creationMode, setCreationMode] =
    useState<ProjectEvaluatorCreationMode | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const environment = useRelayEnvironment();
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
    <Flex
      direction="column"
      alignItems="center"
      justifyContent="center"
      gap="size-300"
      maxWidth="700px"
      margin="var(--global-dimension-size-300) auto"
    >
      <Text size="S" fontStyle="italic" color="text-500">
        No evaluators are set up for this project
      </Text>
      {selectionError ? <Alert variant="danger">{selectionError}</Alert> : null}
      <Flex direction="row" gap="size-125" width="100%">
        <div css={columnCSS}>
          <button
            css={cardCSS}
            onClick={() => setCreationMode({ kind: "scratch" })}
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
              css={cardCSS}
              onClick={async () => {
                setSelectionError(null);
                try {
                  const details = await fetchProjectEvaluatorDetails({
                    environment,
                    evaluatorId: evaluator.id,
                  });
                  if (!isLlmProjectEvaluatorDetails(details)) {
                    throw new Error("Expected an LLM evaluator");
                  }
                  const result = buildCopyLlmCreationMode(details);
                  if (!result.ok) {
                    setSelectionError(UNSUPPORTED_PROMPT_TEMPLATE_ERROR);
                    return;
                  }
                  setCreationMode(result.mode);
                } catch {
                  setSelectionError(
                    "Unable to load evaluator details. Try again."
                  );
                }
              }}
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
        <div css={columnCSS}>
          <button
            css={cardCSS}
            onClick={() => setCreationMode({ kind: "newCode" })}
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
              css={cardCSS}
              onClick={async () => {
                setSelectionError(null);
                try {
                  const details = await fetchProjectEvaluatorDetails({
                    environment,
                    evaluatorId: evaluator.id,
                  });
                  if (!isCodeProjectEvaluatorDetails(details)) {
                    throw new Error("Expected a code evaluator");
                  }
                  setCreationMode(buildAttachCodeCreationMode(details));
                } catch {
                  setSelectionError(
                    "Unable to load evaluator details. Try again."
                  );
                }
              }}
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
      {creationMode ? (
        <CreateProjectEvaluatorSlideover
          isOpen
          onOpenChange={(isOpen) => {
            if (!isOpen) setCreationMode(null);
          }}
          projectId={projectId}
          creationMode={creationMode}
        />
      ) : null}
    </Flex>
  );
}

const cardCSS = css`
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

const columnCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-125);
  flex: 1;
`;
