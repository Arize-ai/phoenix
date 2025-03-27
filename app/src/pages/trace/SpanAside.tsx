import React, { createContext, useCallback, useContext, useState } from "react";
import { graphql, useRefetchableFragment } from "react-relay";
import { css } from "@emotion/react";

import {
  Flex,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
  View,
} from "@phoenix/components";
import { AnnotationLabel } from "@phoenix/components/annotation";
import { SpanAnnotationsEditor } from "@phoenix/components/trace/SpanAnnotationsEditor";

import { SpanAside_span$key } from "./__generated__/SpanAside_span.graphql";
import { SpanAsideSpanQuery } from "./__generated__/SpanAsideSpanQuery.graphql";

export const SpanAsideContext = createContext<{
  tab: "feedback" | "annotate";
  setTab: (tab: string) => void;
}>({
  tab: "feedback",
  setTab: () => {},
});

export const useSpanAsideState = (
  defaultTab: "feedback" | "annotate" = "feedback"
) => {
  const [tab, _setTab] = useState<"feedback" | "annotate">(defaultTab);

  const setTab = useCallback(
    (tab: string) => {
      if (tab === "feedback" || tab === "annotate") {
        _setTab(tab);
      }
    },
    [_setTab]
  );

  return {
    tab,
    setTab,
  };
};

const useSpanAsideContext = () => {
  const context = useContext(SpanAsideContext);
  if (!context) {
    throw new Error("SpanAsideContext not found");
  }
  return context;
};

const annotationListCSS = css`
  display: flex;
  padding-top: var(--ac-global-dimension-size-50);
  flex-direction: column;
  gap: var(--ac-global-dimension-size-100);
  align-items: flex-start;
`;

/**
 * A component that shows the details of a span that is supplementary to the main span details
 */
export function SpanAside(props: { span: SpanAside_span$key }) {
  const { tab, setTab } = useSpanAsideContext();
  const [data] = useRefetchableFragment<SpanAsideSpanQuery, SpanAside_span$key>(
    graphql`
      fragment SpanAside_span on Span
      @refetchable(queryName: "SpanAsideSpanQuery") {
        id
        project {
          id
        }
        code: statusCode
        startTime
        endTime
        tokenCountTotal
        tokenCountPrompt
        tokenCountCompletion
        spanAnnotations {
          id
          name
          label
          annotatorKind
          score
        }
      }
    `,
    props.span
  );
  const annotations = data.spanAnnotations;
  const hasAnnotations = annotations.length > 0;

  return (
    <Tabs
      selectedKey={tab}
      onSelectionChange={(key) => {
        if (key === "feedback" || key === "annotate") {
          setTab(key);
        }
      }}
    >
      <TabList>
        <Tab id="feedback">Feedback</Tab>
        <Tab id="annotate">Annotate</Tab>
      </TabList>
      <TabPanel id="feedback">
        {hasAnnotations ? (
          <ul css={annotationListCSS}>
            {annotations.map((annotation) => (
              <li key={annotation.id}>
                <AnnotationLabel
                  annotation={annotation}
                  annotationDisplayPreference="label"
                />
              </li>
            ))}
          </ul>
        ) : (
          <View padding="size-200">
            <Flex direction="row" alignItems="center" justifyContent="center">
              <Text color="text-300">No Annotations</Text>
            </Flex>
          </View>
        )}
      </TabPanel>
      <TabPanel id="annotate">
        <SpanAnnotationsEditor
          projectId={data.project.id}
          spanNodeId={data.id}
        />
      </TabPanel>
    </Tabs>
  );
}
