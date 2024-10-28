import React, { useMemo, useState } from "react";
import { useLoaderData, useNavigate } from "react-router";

import { Alert, Button, Flex, Icon, Icons } from "@arizeai/components";

import { spanPlaygroundPageLoaderQuery$data } from "./__generated__/spanPlaygroundPageLoaderQuery.graphql";
import { Playground } from "./Playground";
import { transformSpanAttributesToPlaygroundInstance } from "./playgroundUtils";

export function SpanPlaygroundPage() {
  const data = useLoaderData() as spanPlaygroundPageLoaderQuery$data;
  const span = useMemo(() => {
    if (data.span.__typename === "Span") {
      return data.span;
    }
    return null;
  }, [data.span]);

  if (!span) {
    throw new Error("Span not found");
  }

  const { playgroundInstance, parsingErrors } = useMemo(
    () => transformSpanAttributesToPlaygroundInstance(span),
    [span]
  );

  return (
    <Flex direction="column" height={"100%"}>
      <SpanPlaygroundBanners span={span} parsingErrors={parsingErrors} />
      <Playground
        // remount the playground when the span changes, resetting all local state, closing dialogs, etc.
        key={span.id}
        instances={[playgroundInstance]}
      />
    </Flex>
  );
}

function SpanPlaygroundBanners({
  span,
  parsingErrors,
}: {
  span: Extract<
    NonNullable<spanPlaygroundPageLoaderQuery$data["span"]>,
    { __typename: "Span" }
  >;

  parsingErrors?: string[];
}) {
  const navigate = useNavigate();
  const hasParsingErrors = parsingErrors && parsingErrors.length > 0;
  const [showBackBanner, setShowBackBanner] = useState(true);
  const [showParsingErrorsBanner, setShowParsingErrorsBanner] =
    useState(hasParsingErrors);
  return (
    <Flex direction={"column"} gap={"size-50"}>
      {showBackBanner && (
        <Alert
          variant="info"
          title="LLM Span Replay"
          banner
          dismissable
          onDismissClick={() => {
            setShowBackBanner(false);
          }}
          extra={
            <Button
              variant="default"
              icon={<Icon svg={<Icons.ArrowBack />} />}
              onClick={() => {
                navigate(
                  `/projects/${span.project.id}/traces/${span.context.traceId}?selectedSpanNodeId=${span.id}`
                );
              }}
            >
              Back to Trace
            </Button>
          }
        >{`Replay and iterate on your LLM call from your ${span.project.name} project`}</Alert>
      )}
      {showParsingErrorsBanner && hasParsingErrors && (
        <Alert
          variant="warning"
          banner
          dismissable
          onDismissClick={() => {
            setShowParsingErrorsBanner(false);
          }}
          title="The following errors occurred when parsing span attributes:"
        >
          <ul>
            {parsingErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </Alert>
      )}
    </Flex>
  );
}
