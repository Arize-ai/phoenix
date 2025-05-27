import { useMemo, useState } from "react";
import { useLoaderData, useNavigate } from "react-router";
import invariant from "tiny-invariant";

import { Alert, Button, Flex, Icon, Icons } from "@phoenix/components";
import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";
import { spanPlaygroundPageLoaderQuery$data } from "@phoenix/pages/playground/__generated__/spanPlaygroundPageLoaderQuery.graphql";
import { Playground } from "@phoenix/pages/playground/Playground";
import { spanPlaygroundPageLoader } from "@phoenix/pages/playground/spanPlaygroundPageLoader";

import { transformSpanAttributesToPlaygroundInstance } from "./playgroundUtils";

export function SpanPlaygroundPage() {
  const loaderData = useLoaderData<typeof spanPlaygroundPageLoader>();
  invariant(loaderData, "loaderData is required");
  const span = useMemo(() => {
    if (loaderData.span.__typename === "Span") {
      return loaderData.span;
    }
    return null;
  }, [loaderData.span]);

  if (!span) {
    throw new Error("Span not found");
  }

  const { playgroundInstance, parsingErrors, playgroundInput } = useMemo(
    () => transformSpanAttributesToPlaygroundInstance(span),
    [span]
  );

  const additionalProps =
    playgroundInput != null ? { input: playgroundInput } : {};

  return (
    <Flex direction="column" height={"100%"}>
      <SpanPlaygroundBanners span={span} parsingErrors={parsingErrors} />
      <Playground
        // remount the playground when the span changes, resetting all local state, closing dialogs, etc.
        key={span.id}
        instances={[playgroundInstance]}
        {...additionalProps}
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
    <Flex direction={"column"}>
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
              leadingVisual={<Icon svg={<Icons.ArrowBack />} />}
              onPress={() => {
                navigate(
                  `/projects/${span.project.id}/traces/${span.trace.traceId}?${SELECTED_SPAN_NODE_ID_PARAM}=${span.id}`
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
