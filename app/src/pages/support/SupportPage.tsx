import { ReactNode } from "react";
import { css } from "@emotion/react";

import { Flex, Heading, Icon, Icons, Text, View } from "@phoenix/components";

const supportItemsCSS = css`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: var(--ac-global-dimension-size-200);
  padding: var(--ac-global-dimension-size-200);
`;

export function SupportPage() {
  return (
    <main>
      <Flex direction="column" width="100%">
        <View
          padding="size-200"
          borderBottomColor="dark"
          borderBottomWidth="thin"
        >
          <Flex direction="column" gap="size-50">
            <Heading level={1}>Support</Heading>
            <Text color="text-700">
              We are here to help. Pick a channel below to get in touch with us.
            </Text>
          </Flex>
        </View>
        <div css={supportItemsCSS}>
          <SupportItem
            leadingVisual={<Icon svg={<Icons.BookFilled />} />}
            href="https://docs.arize.com/phoenix"
            title="Documentation"
            description="Visit our documentation for tutorials and AI support."
          />
          <SupportItem
            leadingVisual={<Icon svg={<Icons.GitHub />} />}
            href="https://github.com/Arize-ai/phoenix/issues"
            title="GitHub Issues"
            description="Create an issue on Github to report bugs or request new features."
          />
          <SupportItem
            leadingVisual={<Icon svg={<Icons.GitHub />} />}
            href="https://github.com/Arize-ai/phoenix/discussions"
            title="GitHub Discussions"
            description="Create a discussion on Github to ask questions or share feedback."
          />
          <SupportItem
            leadingVisual={<Icon svg={<Icons.Slack />} />}
            href="https://arize-ai.slack.com/join/shared_invite/zt-11t1vbu4x-xkBIHmOREQnYnYDH1GDfCg?__hstc=259489365.a667dfafcfa0169c8aee4178d115dc81.1733501603539.1733501603539.1733501603539.1&__hssc=259489365.1.1733501603539&__hsfp=3822854628&submissionGuid=381a0676-8f38-437b-96f2-fc10875658df#/shared-invite/email"
            title="Slack"
            description="Join our Slack community to chat with other users and the team."
          />
          <SupportItem
            leadingVisual={<Icon svg={<Icons.Slack />} />}
            href="mailto:phoenix-support@arize.com?subject=Slack%20Connect%20Request"
            title="Slack Connect"
            description="Get a dedicated support channel for you and your team."
          />
        </div>
      </Flex>
    </main>
  );
}

const supportItemCSS = css`
  padding: var(--ac-global-dimension-size-200)
    var(--ac-global-dimension-size-200) var(--ac-global-dimension-size-200);
  border: var(--ac-global-border-size-thin) solid
    var(--ac-global-border-color-dark);
  border-radius: var(--ac-global-dimension-size-100);
  cursor: pointer;
  background-color: var(--ac-global-background-color-dark);
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-dimension-size-50);
  color: var(--ac-global-color-text-700);
  transition: border-color 0.2s ease-in-out;
  text-decoration: none;
  &:hover {
    border-color: var(--ac-global-color-primary);
  }
`;

const SupportItem = ({
  leadingVisual,
  href,
  title,
  description,
}: {
  leadingVisual: ReactNode;
  href: string;
  title: string;
  description: string;
}) => {
  return (
    <a css={supportItemCSS} href={href} target="_blank" rel="noreferrer">
      <Flex direction="row" gap="size-100" alignItems="center">
        {leadingVisual}
        <Heading level={2}>{title}</Heading>
      </Flex>
      <Text color="text-700">{description}</Text>
    </a>
  );
};
