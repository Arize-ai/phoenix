import { css } from "@emotion/react";
import type { ReactNode } from "react";

import {
  Flex,
  Heading,
  Icon,
  Icons,
  PageHeader,
  Text,
  View,
} from "@phoenix/components";

const supportItemsCSS = css`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: var(--global-dimension-size-200);
  padding: var(--global-dimension-size-200);
`;

export function SupportPage() {
  return (
    <main>
      <Flex direction="column" width="100%">
        <View borderBottomColor="dark" borderBottomWidth="thin">
          <PageHeader
            title="Support"
            subTitle="We are here to help. Pick a channel below to get in touch with us."
          />
        </View>
        <div css={supportItemsCSS}>
          <SupportItem
            leadingVisual={<Icon svg={<Icons.BookFilled />} />}
            href="https://arize.com/docs/phoenix"
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
            href="https://join.slack.com/t/arize-ai/shared_invite/zt-3r07iavnk-ammtATWSlF0pSrd1DsMW7g"
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
  padding: var(--global-dimension-size-200) var(--global-dimension-size-200)
    var(--global-dimension-size-200);
  border: var(--global-border-size-thin) solid var(--global-border-color-dark);
  border-radius: var(--global-dimension-size-100);
  cursor: pointer;
  background-color: var(--global-background-color-dark);
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-50);
  color: var(--global-color-text-700);
  transition: border-color 0.2s ease-in-out;
  text-decoration: none;
  &:hover {
    border-color: var(--global-color-primary);
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
