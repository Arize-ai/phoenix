import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import { PromptVersionsList } from "@phoenix/pages/prompt/PromptVersionsList";

import type { PromptVersionHistoryKind } from "../../constants/promptVersionFixtures";
import {
  makePromptVersionHistory,
  PROMPT_VERSION_COUNTS,
} from "../../constants/promptVersionFixtures";
import { OptionGrid } from "../../utils/OptionGrid";
import { PromptVersionsEnvironment } from "../../utils/PromptVersionsEnvironment";

/**
 * The versions page's sidebar: every version of a prompt, newest first,
 * in a full-height list that scrolls. The newest is selected, as it is when
 * the page opens.
 */
const meta: Meta = {
  title: "Domains/Prompts/Versions List",
  component: PromptVersionsList,
  tags: ["updated", "unreviewed", "complete"],
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

const LIST_HEIGHT = 420;

function Versions({
  kind,
  count,
  height = LIST_HEIGHT,
}: {
  kind: PromptVersionHistoryKind;
  count: number;
  height?: number;
}) {
  const versions = makePromptVersionHistory({ kind, count });
  return (
    <div style={{ height }}>
      <PromptVersionsEnvironment versions={versions}>
        {(prompt) => (
          <PromptVersionsList
            prompt={prompt}
            itemActive={(version) => version.id === versions[0]?.id}
          />
        )}
      </PromptVersionsEnvironment>
    </div>
  );
}

const COUNTS = PROMPT_VERSION_COUNTS.map((count) => ({
  label: `${count.toLocaleString()} ${count === 1 ? "version" : "versions"}`,
  count,
}));

const KINDS: { label: string; kind: PromptVersionHistoryKind }[] = [
  { label: "Curated", kind: "curated" },
  { label: "Minimal", kind: "minimal" },
];

export const Default: StoryFn = () => <Versions kind="curated" count={6} />;
Default.tags = ["!dev"];

/**
 * Curated versions carry a description, release tags and their author.
 * Minimal versions are what Phoenix records when nobody fills anything in
 * and authentication is off: a number, an ID and a time.
 */
export const VersionCountAndData: StoryFn = () => (
  <OptionGrid
    rows={COUNTS}
    columns={KINDS}
    alignRows="start"
    renderCell={(row, column) => (
      <Versions kind={column?.kind ?? "curated"} count={row.count} />
    )}
  />
);
VersionCountAndData.tags = ["!dev"];
VersionCountAndData.parameters = { themeLayout: "column" };

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  parameters: { thumbnail: { scale: 0.55 } },
  render: () => <Versions kind="curated" count={3} height={340} />,
};
