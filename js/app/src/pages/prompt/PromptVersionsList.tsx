import { graphql, useFragment } from "react-relay";

import type {
  PromptVersionsList__main$data,
  PromptVersionsList__main$key,
} from "./__generated__/PromptVersionsList__main.graphql";
import { PromptVersionSummary } from "./PromptVersionSummary";
import { VersionItem, VersionsList } from "./VersionsList";

type PromptVersion =
  PromptVersionsList__main$data["promptVersions"]["edges"][number]["version"];

type PromptVersionsListProps = {
  prompt: PromptVersionsList__main$key;
  itemActive?: (version: PromptVersion) => boolean;
};

/**
 * Full height, scrollable, list of prompt versions
 */
export const PromptVersionsList = ({
  prompt,
  itemActive,
}: PromptVersionsListProps) => {
  const { promptVersions } = useFragment(
    graphql`
      fragment PromptVersionsList__main on Prompt {
        promptVersions {
          edges {
            version: node {
              id
              ... on PromptVersion {
                ...PromptVersionSummaryFragment
              }
            }
          }
        }
      }
    `,
    prompt
  );
  return (
    <VersionsList>
      {promptVersions.edges.map(({ version }) => (
        <VersionItem
          key={version.id}
          versionId={version.id}
          active={itemActive?.(version)}
        >
          <PromptVersionSummary promptVersion={version} />
        </VersionItem>
      ))}
    </VersionsList>
  );
};
