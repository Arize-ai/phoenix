import { css } from "@emotion/react";

import { Button, Flex } from "@phoenix/components";
import {
  EmptyState,
  EmptyStateArea,
  EmptyStateGraphic,
} from "@phoenix/components/core/empty";

const identifierCSS = css`
  font-family: var(--global-font-family-mono, monospace);
  overflow-wrap: break-word;
`;

const pageCSS = css`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const pageSectionCSS = css`
  width: 500px;
  margin-top: 200px;
  display: flex;
  flex-direction: column;
`;

const actionsCSS = css`
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  align-items: center;
  gap: var(--global-dimension-size-100);
`;

// Not-found view for a missing resource, or for an unmatched route when called
// without props. No stack dump or file-an-issue link, unlike the error view.
export function NotFoundContent({
  entityType,
  identifier,
}: {
  entityType?: string;
  identifier?: string;
}) {
  return (
    <>
      <Flex direction="column" width="100%" alignItems="center">
        <h1>Not found</h1>
      </Flex>
      <p>
        {entityType
          ? `We couldn't find the ${entityType} you're looking for. It may have been deleted, or the link may be incorrect.`
          : "We couldn't find the page you're looking for. The link may be incorrect, or the page may have moved."}
      </p>
      {entityType && identifier ? (
        <p css={identifierCSS}>{identifier}</p>
      ) : null}
      <div css={actionsCSS}>
        <Button
          variant="primary"
          size="S"
          onPress={() => {
            window.location.href = "/";
          }}
        >
          Return Home
        </Button>
      </div>
    </>
  );
}

// Centered full-page wrapper used by the catch-all route.
export function NotFoundPage() {
  return (
    <main css={pageCSS}>
      <section css={pageSectionCSS}>
        <NotFoundContent />
      </section>
    </main>
  );
}

const SETUP_TRACING_HREF =
  "https://arize.com/docs/phoenix/tracing/how-to-tracing/setup-tracing/instrument";

// Shown when a project looked up by name doesn't exist. On first run this is
// expected, so it points the user at exporter setup instead of a plain 404.
export function ProjectOnboardingNotFound({
  projectName,
}: {
  projectName: string;
}) {
  return (
    <EmptyStateArea>
      <EmptyState
        graphic={<EmptyStateGraphic variant="trace" />}
        title="No traces yet"
        description={`We couldn't find a project named "${projectName}". Configure your exporter to send your first trace and it will appear here.`}
        action={{
          type: "strip",
          items: [
            {
              kind: "link",
              label: "Setup tracing",
              href: SETUP_TRACING_HREF,
            },
            {
              kind: "button",
              variant: "primary",
              children: "View projects",
              onPress: () => {
                window.location.href = "/projects";
              },
            },
          ],
        }}
      />
    </EmptyStateArea>
  );
}
