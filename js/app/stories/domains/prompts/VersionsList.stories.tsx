import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import { Timeline } from "@phoenix/components";
import { PromptLatestVersionsList } from "@phoenix/pages/prompt/PromptLatestVersionsList";
import { PromptVersionsList } from "@phoenix/pages/prompt/PromptVersionsList";
import { PromptVersionTimelineItem } from "@phoenix/pages/prompt/PromptVersionSummary";

import type {
  PromptVersionFixture,
  PromptVersionHistoryKind,
} from "../../constants/promptVersionFixtures";
import { makePromptVersionHistory } from "../../constants/promptVersionFixtures";
import { OptionGrid } from "../../utils/OptionGrid";
import {
  PromptVersionItemsEnvironment,
  PromptVersionsEnvironment,
} from "../../utils/PromptVersionsEnvironment";

/**
 * The versions page's sidebar: every version of a prompt, newest first,
 * in a full-height list that scrolls. The newest is selected, as it is when
 * the page opens.
 *
 * Each version is a `PromptVersionTimelineItem`: its number, ID and age,
 * then its description, tags and author when it has them. The prompt page
 * shows the same items as its Latest Versions list
 * (`PromptLatestVersionsList`).
 *
 * An item's hover and keyboard focus styles are not shown.
 */
const meta: Meta = {
  title: "Domains/Prompts/Versions List",
  component: PromptVersionsList,
  subcomponents: { PromptVersionTimelineItem, PromptLatestVersionsList },
  tags: ["updated", "unreviewed", "incomplete"],
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
  hasAuthors = true,
  height = LIST_HEIGHT,
}: {
  kind: PromptVersionHistoryKind;
  count: number;
  hasAuthors?: boolean;
  height?: number;
}) {
  const versions = makePromptVersionHistory({ kind, count }).map((version) =>
    hasAuthors ? version : { ...version, user: null }
  );
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

const COUNTS = [3, 8].map((count) => ({
  label: `${count} versions`,
  count,
}));

const KINDS: { label: string; kind: PromptVersionHistoryKind }[] = [
  { label: "Minimal", kind: "minimal" },
  { label: "Fully loaded", kind: "curated" },
];

export const Default: StoryFn = () => (
  <Versions kind="curated" count={6} hasAuthors={false} />
);
Default.tags = ["!dev"];

/**
 * A minimal version is what Phoenix records when nobody fills anything in
 * and authentication is off: a number, an ID and a time.
 */
export const VersionCountAndData: StoryFn = () => (
  <OptionGrid
    rows={KINDS}
    columns={COUNTS}
    alignRows="start"
    renderCell={(row, column) => (
      <Versions kind={row.kind} count={column?.count ?? 3} />
    )}
  />
);
VersionCountAndData.tags = ["!dev"];
VersionCountAndData.parameters = { themeLayout: "column" };

/** The list's width less its padding and border */
const ITEM_WIDTH = 382;

const HOUR_MS = 60 * 60 * 1000;

function makeVersion(
  version: Partial<PromptVersionFixture> = {}
): PromptVersionFixture {
  const sequenceNumber = version.sequenceNumber ?? 3;
  return {
    id: btoa(`PromptVersion:${sequenceNumber}`),
    sequenceNumber,
    description: null,
    createdAt: new Date(Date.now() - 2 * HOUR_MS).toISOString(),
    user: null,
    tags: [],
    ...version,
  };
}

function makeTags(names: string[]) {
  return names.map((name) => ({ id: btoa(`PromptVersionTag:${name}`), name }));
}

function Item({ version }: { version: PromptVersionFixture }) {
  return (
    <div style={{ width: ITEM_WIDTH }}>
      <PromptVersionItemsEnvironment versions={[version]}>
        {([ref]) => (
          <Timeline>
            <PromptVersionTimelineItem promptVersion={ref} to={version.id} />
          </Timeline>
        )}
      </PromptVersionItemsEnvironment>
    </div>
  );
}

const hoursAgo = (hours: number) =>
  new Date(Date.now() - hours * HOUR_MS).toISOString();

const CREATED: { label: string; createdAt: string }[] = [
  { label: "Saved today", createdAt: hoursAgo(2) },
  { label: "Saved over a week ago", createdAt: hoursAgo(30 * 24) },
];

export const ItemHeader: StoryFn = () => (
  <OptionGrid
    rows={CREATED}
    renderCell={(row) => (
      <Item version={makeVersion({ createdAt: row.createdAt })} />
    )}
  />
);
ItemHeader.tags = ["!dev"];
ItemHeader.parameters = { themeLayout: "column" };

const DESCRIPTIONS: { label: string; description: string }[] = [
  {
    label: "Typical",
    description: "Add few-shot examples for refund requests",
  },
  {
    label: "Long",
    description:
      "Switch to the structured output schema and rename {{question}} to {{customer_message}} across every message template",
  },
];

export const ItemDescription: StoryFn = () => (
  <OptionGrid
    rows={DESCRIPTIONS}
    alignRows="start"
    renderCell={(row) => (
      <Item version={makeVersion({ description: row.description })} />
    )}
  />
);
ItemDescription.tags = ["!dev"];
ItemDescription.parameters = { themeLayout: "column" };

const TAGS: { label: string; tags: string[] }[] = [
  { label: "None", tags: [] },
  { label: "One", tags: ["production"] },
  { label: "Several", tags: ["production", "staging", "development"] },
  {
    label: "Wrapping",
    tags: [
      "production",
      "staging",
      "development",
      "canary",
      "baseline-before-schema-migration",
    ],
  },
];

export const ItemTags: StoryFn = () => (
  <OptionGrid
    rows={TAGS}
    alignRows="start"
    renderCell={(row) => (
      <Item version={makeVersion({ tags: makeTags(row.tags) })} />
    )}
  />
);
ItemTags.tags = ["!dev"];
ItemTags.parameters = { themeLayout: "column" };

/**
 * A version's author shows only when Phoenix knows who saved it. Versions
 * saved with authentication off, or before it was turned on, have none, and
 * so do versions whose author's account was deleted.
 */
export const ItemAuthor: StoryFn = () => (
  <Item
    version={makeVersion({
      description: "Lower temperature to 0.2 to reduce variance between runs",
      user: { id: "VXNlcjoy", username: "mkowalski", profilePictureUrl: null },
    })}
  />
);
ItemAuthor.tags = ["!dev"];

const ASIDE_CONTENT_WIDTH = 368;

/**
 * The prompt page's aside shows only the five newest versions, fading out
 * below the fifth when older ones exist, with a link to the versions page
 * for the full history. Nothing in it is selected, since no version is open
 * on the prompt page.
 */
export const LatestVersionsList: StoryFn = () => (
  <div style={{ width: ASIDE_CONTENT_WIDTH }}>
    <PromptVersionsEnvironment
      versions={makePromptVersionHistory({ kind: "curated", count: 6 })}
    >
      {(prompt) => <PromptLatestVersionsList prompt={prompt} />}
    </PromptVersionsEnvironment>
  </div>
);
LatestVersionsList.tags = ["!dev"];

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  parameters: { thumbnail: { scale: 0.55 } },
  render: () => <Versions kind="curated" count={3} height={340} />,
};
