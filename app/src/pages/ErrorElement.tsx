import React, { useMemo } from "react";
import { useRouteError } from "react-router";
import { css } from "@emotion/react";

import { Button, EmptyGraphic, Flex } from "@arizeai/components";

import { ExternalLink } from "@phoenix/components";

export function ErrorElement() {
  const error = useRouteError();

  const content = useMemo(() => {
    if (error instanceof Error && error.message === "Failed to fetch") {
      // We know this means the server disconnected
      return <NotFoundContent />;
    }
    return <ErrorContent error={error} />;
  }, [error]);
  return (
    <main
      css={css`
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      `}
    >
      <section
        css={css`
          width: 500px;
          /* Add spacing on the bottom so it gets pushed up */
          margin-bottom: 500px;
          display: flex;
          flex-direction: column;
        `}
      >
        {content}
      </section>
    </main>
  );
}

function NotFoundContent() {
  return (
    <>
      <Flex direction="column" width="100%" alignItems="center">
        <EmptyGraphic graphicKey="not found" />
        <h1>Server disconnected</h1>
      </Flex>
      <p>
        We are unable to reach the phoenix server. This is most likely due to
        the notebook runtime being no longer active. Please restart phoenix by
        re-running the initialization cell.
      </p>
    </>
  );
}

function ErrorContent({ error }: { error: unknown }) {
  return (
    <>
      <Flex direction="column" width="100%" alignItems="center">
        <EmptyGraphic graphicKey="error" />
        <h1>Something went wrong</h1>
      </Flex>
      <p>
        We strive to do our very best but 🐛 bugs happen. It would mean a lot to
        us if you could file a an issue. If you feel comfortable, please include
        the error details below in your issue. We will get back to you as soon
        as we can.
      </p>
      <p
        css={css`
          display: flex;
          flex-direction: row;
          justify-content: flex-end;
          gap: var(--px-spacing-med);
        `}
      >
        <span
          css={css`
            display: inline-flex;
            flex-direction: row;
            align-items: baseline;
            gap: 0.2em;
          `}
        >
          💙 the
          <ExternalLink href="mailto:phoenix-devs@arize.com">
            phoenix team
          </ExternalLink>
        </span>
      </p>
      <div
        css={css`
          display: flex;
          flex-direction: row;
          justify-content: flex-end;
          align-items: center;
          gap: var(--px-spacing-med);
        `}
      >
        <ExternalLink href="https://github.com/Arize-ai/phoenix/issues/new?assignees=&labels=bug&template=bug_report.md&title=%5BBUG%5D">
          file an issue with us
        </ExternalLink>

        <Button
          variant="primary"
          size="compact"
          onClick={() => {
            window.location.href = "/";
          }}
        >
          Return Home
        </Button>
      </div>
      <details>
        <summary>error details</summary>
        <pre
          css={css`
            white-space: pre-wrap;
            overflow-wrap: break-word;
            overflow: hidden;
            overflow-y: auto;
            max-height: 500px;
          `}
        >
          {error instanceof Error ? error.message : null}
        </pre>
      </details>
    </>
  );
}
