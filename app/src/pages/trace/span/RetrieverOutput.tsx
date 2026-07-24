import { css } from "@emotion/react";
import { Fragment } from "react";

import { Card, Flex, Heading, View } from "@phoenix/components";
import {
  ConnectedMarkdownModeSelect,
  MarkdownDisplayProvider,
} from "@phoenix/components/markdown";
import type { AttributeDocument } from "@phoenix/openInference/tracing/types";

import { RetrievalEvaluationLabel } from "../../project/RetrievalEvaluationLabel";
import { DocumentItem } from "../DocumentItem";
import { defaultCardProps } from "./constants";
import type { DocumentEvaluation, RetrievalMetric } from "./types";

/**
 * The output of a retriever span — the retrieved documents along with their
 * retrieval metrics and document evaluations.
 */
export function RetrieverOutput({
  documents,
  documentEvaluationsByPosition,
  retrievalMetrics,
  spanNodeId,
}: {
  documents: AttributeDocument[];
  /** Document evaluations grouped by the position of the document they annotate */
  documentEvaluationsByPosition: Partial<Record<number, DocumentEvaluation[]>>;
  retrievalMetrics: ReadonlyArray<RetrievalMetric>;
  /** The relay node ID of the span, used for annotating documents */
  spanNodeId: string;
}) {
  const hasDocumentRetrievalMetrics = retrievalMetrics.length > 0;
  return (
    <MarkdownDisplayProvider>
      <Card
        title="Output"
        subTitle="Documents"
        {...defaultCardProps}
        extra={<ConnectedMarkdownModeSelect />}
      >
        {hasDocumentRetrievalMetrics && (
          <View
            borderColor="default"
            borderBottomWidth="thin"
            padding="size-200"
          >
            <Flex direction="column" gap="size-100">
              <Heading level={4} weight="heavy">
                Retrieval Metrics
              </Heading>
              <Flex
                direction="row"
                alignItems="center"
                gap="size-100"
                wrap="wrap"
              >
                {retrievalMetrics.map((retrievalMetric) => {
                  return (
                    <Fragment key={retrievalMetric.evaluationName}>
                      <RetrievalEvaluationLabel
                        name={retrievalMetric.evaluationName}
                        metric="ndcg"
                        score={retrievalMetric.ndcg}
                      />
                      <RetrievalEvaluationLabel
                        name={retrievalMetric.evaluationName}
                        metric="precision"
                        score={retrievalMetric.precision}
                      />
                      <RetrievalEvaluationLabel
                        name={retrievalMetric.evaluationName}
                        metric="hit"
                        score={retrievalMetric.hit}
                      />
                    </Fragment>
                  );
                })}
              </Flex>
            </Flex>
          </View>
        )}
        <ul
          css={css`
            display: flex;
            flex-direction: column;
            gap: var(--global-dimension-size-200);
            padding: var(--global-dimension-size-200);
          `}
        >
          {documents.map((document, idx) => {
            return (
              <li key={idx}>
                <DocumentItem
                  document={document}
                  documentAnnotations={documentEvaluationsByPosition[idx]}
                  borderColor={"seafoam-300"}
                  backgroundColor={"seafoam-100"}
                  tokenColor="var(--global-color-seafoam-1000)"
                  spanNodeId={spanNodeId}
                  documentPosition={idx}
                />
              </li>
            );
          })}
        </ul>
      </Card>
    </MarkdownDisplayProvider>
  );
}
