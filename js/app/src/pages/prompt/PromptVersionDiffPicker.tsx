import { css } from "@emotion/react";
import { useMemo } from "react";
import { Autocomplete, Input, useFilter } from "react-aria-components";
import { graphql, useFragment } from "react-relay";

import {
  Button,
  Icon,
  Icons,
  Menu,
  MenuContainer,
  MenuHeader,
  MenuItem,
  MenuTrigger,
  SearchField,
  SelectChevronUpDownIcon,
  Text,
} from "@phoenix/components";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { SearchIcon } from "@phoenix/components/core/field";

import type { PromptVersionDiffPicker__versions$key } from "./__generated__/PromptVersionDiffPicker__versions.graphql";
import { PromptVersionSummary } from "./PromptVersionSummary";

const PICKER_MENU_WIDTH = 400;

const menuItemCSS = css`
  width: 100%;
  min-width: 0;
`;

/**
 * Chooses the version that the viewed version is compared against. Lists the
 * prompt's other versions the same way the version timeline does.
 */
export function PromptVersionDiffPicker({
  prompt,
  currentVersionId,
  selectedVersionId,
  onSelectionChange,
}: {
  prompt: PromptVersionDiffPicker__versions$key;
  currentVersionId: string;
  selectedVersionId: string;
  onSelectionChange: (versionId: string) => void;
}) {
  const { contains } = useFilter({ sensitivity: "base" });
  const { promptVersions } = useFragment<PromptVersionDiffPicker__versions$key>(
    graphql`
      fragment PromptVersionDiffPicker__versions on Prompt {
        promptVersions {
          edges {
            version: node {
              id
              ... on PromptVersion {
                sequenceNumber
                description
                tags {
                  name
                }
                user {
                  username
                }
                ...PromptVersionSummaryFragment
              }
            }
          }
        }
      }
    `,
    prompt
  );
  const versions = useMemo(
    () =>
      promptVersions.edges
        .map(({ version }) => version)
        .filter((version) => version.id !== currentVersionId),
    [promptVersions, currentVersionId]
  );
  const selectedVersion = versions.find(
    (version) => version.id === selectedVersionId
  );
  return (
    <MenuTrigger>
      <Button size="S" aria-label="Version to compare against">
        <Text fontFamily="mono">
          {selectedVersion ? `v${selectedVersion.sequenceNumber}` : "Version"}
        </Text>
        <SelectChevronUpDownIcon />
      </Button>
      <MenuContainer
        placement="bottom end"
        minHeight={0}
        minWidth={PICKER_MENU_WIDTH}
        maxWidth={PICKER_MENU_WIDTH}
      >
        <Autocomplete filter={contains}>
          <MenuHeader>
            <SearchField aria-label="Search versions" variant="quiet" autoFocus>
              <SearchIcon />
              <Input placeholder="Search versions" />
            </SearchField>
          </MenuHeader>
          <Menu
            items={versions}
            selectionMode="single"
            selectedKeys={[selectedVersionId]}
            renderEmptyState={() => (
              <CompactEmptyState
                icon={<Icon svg={<Icons.GitBranch />} />}
                description="No versions"
              />
            )}
            onAction={(key) => onSelectionChange(String(key))}
          >
            {(version) => (
              <MenuItem
                id={version.id}
                textValue={[
                  `v${version.sequenceNumber}`,
                  version.id,
                  version.description ?? "",
                  version.user?.username ?? "",
                  ...version.tags.map((tag) => tag.name),
                ].join("\n")}
              >
                <div css={menuItemCSS}>
                  <PromptVersionSummary promptVersion={version} />
                </div>
              </MenuItem>
            )}
          </Menu>
        </Autocomplete>
      </MenuContainer>
    </MenuTrigger>
  );
}
