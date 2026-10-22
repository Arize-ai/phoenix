import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import { PromptLatestVersionsList } from "@phoenix/pages/prompt/PromptLatestVersionsList";

import type { PromptVersionHistoryKind } from "../../constants/promptVersionFixtures";
import {
  makePromptVersionHistory,
  PROMPT_VERSION_COUNTS,
} from "../../constants/promptVersionFixtures";
import { OptionGrid } from "../../utils/OptionGrid";
import { PromptVersionsEnvironment } from "../../utils/PromptVersionsEnvironment";

/**
 * The prompt page's "Latest Versions" timeline: the five newest versions,
 * with the timeline fading out when older ones exist.
 */
const meta: Meta = {
  title: "Domains/Prompts/Latest Versions List",
  component: PromptLatestVersionsList,
  tags: ["updated", "unreviewed", "complete"],
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

const ASIDE_CONTENT_WIDTH = 368;

function LatestVersions({
  kind,
  count,
}: {
  kind: PromptVersionHistoryKind;
  count: number;
}) {
  return (
    <div style={{ width: ASIDE_CONTENT_WIDTH }}>
      <PromptVersionsEnvironment
        versions={makePromptVersionHistory({ kind, count })}
      >
        {(prompt) => <PromptLatestVersionsList prompt={prompt} />}
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

export const Default: StoryFn = () => (
  <LatestVersions kind="curated" count={6} />
);
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
    cellWidth={`${ASIDE_CONTENT_WIDTH}px`}
    alignRows="start"
    renderCell={(row, column) => (
      <LatestVersions kind={column?.kind ?? "curated"} count={row.count} />
    )}
  />
);
VersionCountAndData.tags = ["!dev"];
VersionCountAndData.parameters = { themeLayout: "column" };

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  parameters: { thumbnail: { scale: 0.55 } },
  render: () => <LatestVersions kind="curated" count={3} />,
};
