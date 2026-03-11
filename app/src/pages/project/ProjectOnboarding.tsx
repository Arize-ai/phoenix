import { css } from "@emotion/react";
import { useState } from "react";

import {
  Flex,
  ProgressCircle,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
} from "@phoenix/components";
import { usePreferencesContext } from "@phoenix/contexts";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";

import { OnboardingSteps } from "./OnboardingSteps";

const onboardingCSS = css`
  overflow-y: auto;
  height: 100%;
`;

const onboardingInnerCSS = css`
  padding: var(--global-dimension-size-400);
  max-width: 800px;
  min-width: 500px;
  box-sizing: border-box;
  width: 100%;
  margin-left: auto;
  margin-right: auto;
`;

const awaitingTracesCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
  background-color: var(--global-color-gray-100);
  border-radius: var(--global-rounding-medium);
`;

export function ProjectOnboarding({ projectName }: { projectName: string }) {
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);
  const { isStreaming } = useStreamState();
  const programmingLanguage = usePreferencesContext(
    (state) => state.programmingLanguage
  );
  const defaultTab =
    programmingLanguage === "TypeScript" ? "typescript" : "python";

  return (
    <div css={onboardingCSS}>
      <div css={onboardingInnerCSS}>
        <Flex direction="column" gap="size-200">
          <div css={awaitingTracesCSS}>
            {isStreaming ? (
              <ProgressCircle isIndeterminate size="S" aria-label="loading" />
            ) : null}
            <Text>
              {isStreaming
                ? "Waiting for traces to arrive..."
                : "Follow the steps below to start sending traces"}
            </Text>
          </div>
          <Tabs defaultSelectedKey={defaultTab}>
            <TabList>
              <Tab id="python">Python</Tab>
              <Tab id="typescript">Typescript</Tab>
            </TabList>
            <TabPanel id="python">
              <OnboardingSteps
                language="Python"
                projectName={projectName}
                generatedApiKey={generatedApiKey}
                onApiKeyGenerated={setGeneratedApiKey}
              />
            </TabPanel>
            <TabPanel id="typescript">
              <OnboardingSteps
                language="TypeScript"
                projectName={projectName}
                generatedApiKey={generatedApiKey}
                onApiKeyGenerated={setGeneratedApiKey}
              />
            </TabPanel>
          </Tabs>
        </Flex>
      </div>
    </div>
  );
}
