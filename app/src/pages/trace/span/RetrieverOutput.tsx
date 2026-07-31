import { css } from "@emotion/react";
import { Fragment } from "react";

import {
  CopyToClipboardButton,
  Flex,
  Heading,
  Text,
  View,
} from "@phoenix/components";
import {
  ConnectedMarkdownModeSelect,
  MarkdownDisplayProvider,
} from "@phoenix/components/markdown";
import type { AttributeDocument } from "@phoenix/openInference/tracing/types";

import { RetrievalMetricLabel } from "../../project/RetrievalMetricLabel";
import { DocumentItem } from "../DocumentItem";
import { SpanDetailsDisclosureSection } from "../SpanDetailsDisclosureSection";
import { useSpanInfoCardProps } from "../SpanInfoCardsContext";
import type { DocumentEvaluation, RetrievalMetric } from "./types";
import type { SpanInfoSectionProps } from "./types";
import { formatJSONForCopy } from "./utils";

/**
 * The output of a retriever span — the retrieved documents along with their
 * retrieval metrics and document evaluations.
 */
export function RetrieverOutput({
  documents,
  documentEvaluationsByPosition,
  retrievalMetrics,
  spanNodeId,
  sectionId,
  bordered,
}: {
  documents: AttributeDocument[];
  /** Document evaluations grouped by the position of the document they annotate */
  documentEvaluationsByPosition: Partial<Record<number, DocumentEvaluation[]>>;
  retrievalMetrics: ReadonlyArray<RetrievalMetric>;
  /** The relay node ID of the span, used for annotating documents */
  spanNodeId: string;
} & SpanInfoSectionProps) {
  const hasDocumentRetrievalMetrics = retrievalMetrics.length > 0;
  const cardProps = useSpanInfoCardProps("output");
  return (
    <MarkdownDisplayProvider>
      <SpanDetailsDisclosureSection
        sectionId={sectionId}
        bordered={bordered}
        title="Output"
        titleExtra={<Text color="text-700">Documents</Text>}
        {...cardProps}
        extra={
          <Flex direction="row" gap="size-100" alignItems="center">
            <ConnectedMarkdownModeSelect />
            <CopyToClipboardButton text={formatJSONForCopy(documents)} />
          </Flex>
        }
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
                      <RetrievalMetricLabel
                        name={retrievalMetric.evaluationName}
                        metric="ndcg"
                        score={retrievalMetric.ndcg}
                      />
                      <RetrievalMetricLabel
                        name={retrievalMetric.evaluationName}
                        metric="precision"
                        score={retrievalMetric.precision}
                      />
                      <RetrievalMetricLabel
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
      </SpanDetailsDisclosureSection>
    </MarkdownDisplayProvider>
  );
}
