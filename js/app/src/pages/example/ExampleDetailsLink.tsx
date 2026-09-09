import { css } from "@emotion/react";
import { useState } from "react";

import {
  Button,
  ViewportModal,
  ViewportModalOverlay,
} from "@phoenix/components";

import { ExampleDetailsDialog } from "./ExampleDetailsDialog";

export function ExampleDetailsLink({
  exampleId,
  externalId,
  datasetVersionId,
}: {
  exampleId: string;
  externalId?: string | null;
  datasetVersionId?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const displayId = externalId ?? exampleId;

  return (
    <>
      <Button
        variant="quiet"
        size="S"
        aria-label={`View example ${displayId}`}
        aria-haspopup="dialog"
        onPress={() => setIsOpen(true)}
        css={css`
          &&& {
            display: inline-flex;
            flex: 0 1 auto;
            height: auto;
            min-width: 0;
            max-width: 100%;
            padding: 0;
            border: 0;
            color: var(--global-link-color);
            vertical-align: baseline;
          }
          &[data-hovered] {
            text-decoration: underline;
          }
        `}
      >
        <span
          title={displayId}
          css={css`
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          `}
        >
          {displayId}
        </span>
      </Button>
      <ViewportModalOverlay isOpen={isOpen} onOpenChange={setIsOpen}>
        <ViewportModal size="fullscreen">
          <ExampleDetailsDialog
            exampleId={exampleId}
            datasetVersionId={datasetVersionId}
          />
        </ViewportModal>
      </ViewportModalOverlay>
    </>
  );
}
