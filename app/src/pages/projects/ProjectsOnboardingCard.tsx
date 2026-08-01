import { css } from "@emotion/react";

import {
  Disclosure,
  DisclosurePanel,
  DisclosureTrigger,
  Flex,
  Icon,
  Icons,
  Text,
  View,
} from "@phoenix/components";
import { ProjectOnboarding } from "@phoenix/pages/project/ProjectOnboarding";

const panelContentCSS = css`
  border-top: 1px solid var(--global-color-gray-200);
  padding-top: var(--global-dimension-size-200);
  margin-top: var(--global-dimension-size-100);
`;

/**
 * A compact, collapsible onboarding card shown at the top of the projects page
 * when the account has no traces in any project. It gives a short explainer up
 * front and expands to reveal a guided setup flow inline — select a project,
 * choose an SDK, then follow the setup steps — so users can send their first
 * trace without drilling into a project.
 */
export function ProjectsOnboardingCard({
  projectName,
  projectNames,
}: {
  /** The project pre-selected in the setup flow (e.g. "default"). */
  projectName: string;
  /** Existing project names offered in the project selector. */
  projectNames: readonly string[];
}) {
  return (
    <View
      backgroundColor="gray-75"
      borderColor="default"
      borderWidth="thin"
      borderRadius="medium"
      padding="size-200"
      width="100%"
    >
      <Disclosure id="projects-onboarding" defaultExpanded={false}>
        <DisclosureTrigger justifyContent="space-between">
          <Flex direction="row" gap="size-150" alignItems="center">
            <Icon svg={<Icons.Rocket />} />
            <Flex direction="column" gap="size-25" alignItems="start">
              <Text weight="heavy" size="M">
                Send your first trace
              </Text>
              <Text color="text-700" size="S">
                No traces yet. Follow the setup instructions to start sending
                traces to Phoenix — no need to open a project.
              </Text>
            </Flex>
          </Flex>
        </DisclosureTrigger>
        <DisclosurePanel>
          <div css={panelContentCSS}>
            <ProjectOnboarding
              projectName={projectName}
              projectNames={projectNames}
              showProjectSelector
              embedded
            />
          </div>
        </DisclosurePanel>
      </Disclosure>
    </View>
  );
}
