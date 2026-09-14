import { css } from "@emotion/react";
import type { PropsWithChildren, ReactNode } from "react";
import { Group } from "react-resizable-panels";

import {
  Button,
  Flex,
  Icon,
  Icons,
  Loading,
  PageHeader,
  View,
} from "@phoenix/components";
import { TitledPanel } from "@phoenix/components/react-resizable-panels";

import { PlaygroundModeSelect } from "../PlaygroundModeSelect";
import { EvaluatorPlaygroundRunButton } from "./EvaluatorPlaygroundRunButton";

/** The same page frame is available before the evaluator editor bundle loads. */
export function EvaluatorPlaygroundFrame({
  children,
  actions,
}: PropsWithChildren<{ actions?: ReactNode }>) {
  return (
    <div css={frameCSS}>
      <View borderBottomColor="default" borderBottomWidth="thin" flex="none">
        <PageHeader
          title="Playground"
          extra={
            // The mode switch sits level with the title, set apart from the
            // mode's own actions so it reads as "which playground" rather than
            // as another action.
            <Flex direction="row" gap="size-300" alignItems="center">
              <PlaygroundModeSelect />
              {actions}
            </Flex>
          }
        />
      </View>
      {children}
    </div>
  );
}

export function EvaluatorPlaygroundLoading() {
  return (
    <EvaluatorPlaygroundFrame
      actions={
        // Stand-ins for the page's controls, so the header keeps its width.
        <Flex direction="row" gap="size-100" alignItems="center">
          <Button
            size="S"
            isDisabled
            leadingVisual={<Icon svg={<Icons.Key />} />}
          >
            API Keys
          </Button>
          <Button
            size="S"
            isDisabled
            aria-label="Playground Settings"
            leadingVisual={<Icon svg={<Icons.Options />} />}
          />
          <EvaluatorPlaygroundRunButton
            isRunning={false}
            isDisabled
            onRun={() => {}}
            onStop={() => {}}
          />
        </Flex>
      }
    >
      <Group orientation="vertical" style={{ flex: 1, minHeight: 0 }}>
        <TitledPanel
          title="Evaluators"
          headingLevel={2}
          panelProps={{ defaultSize: 55, minSize: 15 }}
        >
          <Loading />
        </TitledPanel>
        <TitledPanel
          title="Results"
          headingLevel={2}
          resizable
          panelProps={{ defaultSize: 45, minSize: 15 }}
        >
          <Loading />
        </TitledPanel>
      </Group>
    </EvaluatorPlaygroundFrame>
  );
}

const frameCSS = css`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
`;
