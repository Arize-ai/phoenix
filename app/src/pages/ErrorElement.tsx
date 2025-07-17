import { useMemo } from "react";
import { useRouteError } from "react-router";
import { css } from "@emotion/react";

import { EmptyGraphic } from "@arizeai/components";

import { Button, ExternalLink, Flex } from "@phoenix/components";

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
          /* Add spacing on the bottom so it gets pushed down */
          margin-top: 200px;
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
        We are unable to reach the Phoenix server. Please ensure that Phoenix is
        running and try again.
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
          gap: var(--ac-global-dimension-static-size-100);
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
          gap: var(--ac-global-dimension-static-size-100);
        `}
      >
        <ExternalLink href="https://github.com/Arize-ai/phoenix/issues/new?assignees=&labels=bug&template=bug_report.md&title=%5BBUG%5D">
          file an issue with us
        </ExternalLink>

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
      <details open>
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
