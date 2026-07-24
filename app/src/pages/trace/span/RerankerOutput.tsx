import { css } from "@emotion/react";

import { Card, Counter } from "@phoenix/components";
import type { AttributeDocument } from "@phoenix/openInference/tracing/types";

import { DocumentItem } from "../DocumentItem";
import { defaultCardProps } from "./constants";

/**
 * The output side of a reranker span — the documents after reranking.
 */
export function RerankerOutput({
  outputDocuments,
}: {
  outputDocuments: AttributeDocument[];
}) {
  const numOutputDocuments = outputDocuments.length;
  return (
    <Card
      title={"Output Documents"}
      titleExtra={<Counter>{numOutputDocuments}</Counter>}
      {...defaultCardProps}
    >
      {
        <ul
          css={css`
            padding: var(--global-dimension-size-200);
            display: flex;
            flex-direction: column;
            gap: var(--global-dimension-size-200);
          `}
        >
          {outputDocuments.map((document, idx) => {
            return (
              <li key={idx}>
                <DocumentItem
                  document={document}
                  borderColor={"celery-300"}
                  backgroundColor={"celery-100"}
                  tokenColor="var(--global-color-celery-500)"
                />
              </li>
            );
          })}
        </ul>
      }
    </Card>
  );
}
