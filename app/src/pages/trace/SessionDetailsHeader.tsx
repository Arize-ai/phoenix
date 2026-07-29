import type { ReactNode } from "react";

import { CopyableIDBadge, Flex } from "@phoenix/components";
import { Skeleton } from "@phoenix/components/core/loading";
import { SessionTokenCosts } from "@phoenix/components/trace/SessionTokenCosts";
import { SessionTokenCount } from "@phoenix/components/trace/SessionTokenCount";

import {
  DetailHeader,
  DetailHeaderIdentityRow,
  DetailHeaderMetaItem,
  DetailHeaderMetaRow,
  DetailHeaderTitle,
} from "../DetailHeader";
import type { SessionPreview } from "./SessionPaginationContext";

/** Header shared by loaded session details and their preview-aware skeleton. */
export function SessionDetailsHeader({
  annotationBar,
  preview,
}: {
  annotationBar?: ReactNode;
  preview: SessionPreview;
}) {
  const { sessionId, sessionDisplayId, tokenCountTotal, totalCost } = preview;

  return (
    <DetailHeader annotationBar={annotationBar}>
      <Flex direction="column" gap="size-50" width="100%">
        <DetailHeaderIdentityRow>
          <DetailHeaderTitle title="Session" />
          {sessionDisplayId != null ? (
            <CopyableIDBadge
              id={sessionDisplayId}
              showValue={false}
              tooltipText="Copy Session ID"
            />
          ) : (
            <Skeleton width={20} height={20} animation="wave" />
          )}
        </DetailHeaderIdentityRow>
        <DetailHeaderMetaRow>
          {tokenCountTotal === undefined ? (
            <DetailHeaderMetaItem>
              <Skeleton width={64} height={16} animation="wave" />
            </DetailHeaderMetaItem>
          ) : tokenCountTotal ? (
            <DetailHeaderMetaItem>
              <SessionTokenCount
                tokenCountTotal={tokenCountTotal}
                nodeId={sessionId}
                size="S"
                color="text-500"
              />
            </DetailHeaderMetaItem>
          ) : null}
          {totalCost === undefined ? (
            <DetailHeaderMetaItem>
              <Skeleton width={64} height={16} animation="wave" />
            </DetailHeaderMetaItem>
          ) : totalCost ? (
            <DetailHeaderMetaItem>
              <SessionTokenCosts
                totalCost={totalCost}
                nodeId={sessionId}
                size="S"
                color="text-500"
              />
            </DetailHeaderMetaItem>
          ) : null}
        </DetailHeaderMetaRow>
      </Flex>
    </DetailHeader>
  );
}
