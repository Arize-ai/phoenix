import React, { useEffect, useState } from "react";
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
export function SpanAside(props: {
  span: SpanAside_span$key;
  defaultTab?: "feedback" | "annotations";
}) {
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
  const [tab, setTab] = useState<"feedback" | "annotations">(
    props.defaultTab ?? "feedback"
  );

  useEffect(() => {
    if (props.defaultTab) {
      setTab(props.defaultTab);
    }
  }, [props.defaultTab]);

  return (
    <Tabs
      selectedKey={tab}
      onSelectionChange={(key) => {
        if (key === "feedback" || key === "annotations") {
          setTab(key);
        }
      }}
    >
      <TabList>
        <Tab id="feedback">Feedback</Tab>
        <Tab id="annotations">Annotate</Tab>
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
      <TabPanel id="annotations">
        <SpanAnnotationsEditor
          projectId={data.project.id}
          spanNodeId={data.id}
        />
      </TabPanel>
    </Tabs>
  );
}
