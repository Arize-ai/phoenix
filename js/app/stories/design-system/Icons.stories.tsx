import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import {
  Icon,
  IconButton,
  Icons,
  Input,
  SearchField,
  Tooltip,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import type { ChartTypeIconType } from "@phoenix/components/chart";
import { CHART_TYPE_LABELS, ChartTypeIcon } from "@phoenix/components/chart";
import { Button } from "@phoenix/components/core/button/Button";
import { SearchIcon } from "@phoenix/components/core/field";
import { RecordIcon } from "@phoenix/components/core/icon/RecordIcon";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import { INTEGRATION_ICONS } from "@phoenix/components/project/IntegrationIcons";
import { SandboxProviderIcon } from "@phoenix/components/sandbox/SandboxProviderIcon";
import { ModelProviders } from "@phoenix/constants/generativeConstants";
import type { SandboxBackendType } from "@phoenix/types/evaluators";

import { OptionGrid } from "../utils/OptionGrid";

const meta: Meta = {
  title: "Design System/Icons",
  tags: ["updated", "unreviewed", "incomplete"],
  component: Icon,
  subcomponents: {
    ChartTypeIcon,
    GenerativeProviderIcon,
    SandboxProviderIcon,
    RecordIcon,
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rMddnj6eV2TcQqNkejJ9qX/Core?node-id=6-455",
    },
  },
};

export default meta;

function IconsGallery() {
  const [search, setSearch] = useState("");
  const isSearching = search.length > 0;

  const iconEntries = Object.keys(Icons).filter((name) => {
    if (!search) return true;
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <View padding="size-200">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <SearchField
          value={search}
          onChange={setSearch}
          aria-label="Search icons"
          size="M"
          style={{ maxWidth: 320 }}
        >
          <SearchIcon />
          <Input placeholder="Search icons..." />
        </SearchField>
        {isSearching ? (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {iconEntries.map((name) => {
              const Svg = Icons[name as keyof typeof Icons];
              return (
                <li
                  key={name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <IconButton>
                    <Icon svg={<Svg />} />
                  </IconButton>
                  <span>{name}</span>
                </li>
              );
            })}
            {iconEntries.length === 0 && (
              <li style={{ color: "var(--global-text-color-500)" }}>
                No icons found
              </li>
            )}
          </ul>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
            }}
          >
            {iconEntries.map((name) => {
              const Svg = Icons[name as keyof typeof Icons];
              return (
                <li key={name}>
                  <TooltipTrigger delay={0}>
                    <IconButton>
                      <Icon svg={<Svg />} />
                    </IconButton>
                    <Tooltip>{name}</Tooltip>
                  </TooltipTrigger>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </View>
  );
}

type Story = StoryObj;

export const IconSet: Story = {
  tags: ["!dev"],
  parameters: { themeLayout: "column" },
  render: () => <IconsGallery />,
};

const CHART_TYPES: ChartTypeIconType[] = ["bar", "barHorizontal", "line"];

/** 24 is the default; the metric chart picker uses 28. */
const CHART_TYPE_SIZES = [16, 20, 24, 28, 32, 48];

/**
 * These glyphs let a reader recognize a chart by its shape — vertical bars,
 * a ranked horizontal "top N" chart, or a line — independent of the chart's
 * series colors.
 */
export const ChartTypeIcons: Story = {
  tags: ["!dev"],
  parameters: { themeLayout: "column" },
  render: () => (
    <OptionGrid
      rows={CHART_TYPES.map((type) => ({
        label: CHART_TYPE_LABELS[type],
        type,
      }))}
      columns={CHART_TYPE_SIZES.map((size) => ({
        label: String(size),
        code: true,
        size,
      }))}
      justifyCells="center"
      renderCell={(row, column) => (
        <ChartTypeIcon type={row.type} size={column?.size} />
      )}
    />
  ),
};

const providers = Object.entries(ModelProviders)
  .map(([key, name]) => ({ key: key as ModelProvider, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

const SANDBOX_PROVIDER_KINDS = Object.keys({
  DAYTONA: true,
  DENO: true,
  DOCKER: true,
  E2B: true,
  MODAL: true,
  MONTY: true,
  VERCEL: true,
  WASM: true,
} satisfies Record<SandboxBackendType, true>) as SandboxBackendType[];

const markListStyle: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const markItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

export const GenerativeProviders: Story = {
  tags: ["!dev"],
  render: () => (
    <ul style={markListStyle}>
      {providers.map(({ key, name }) => (
        <li key={key} style={markItemStyle}>
          <GenerativeProviderIcon provider={key} height={24} />
          <span>{name}</span>
        </li>
      ))}
    </ul>
  ),
};

export const Integrations: Story = {
  tags: ["!dev"],
  render: () => (
    <ul style={markListStyle}>
      {Object.entries(INTEGRATION_ICONS)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, IntegrationIcon]) => (
          <li key={key} style={markItemStyle}>
            <IntegrationIcon />
            <span>{key.replace(/SVG$/, "")}</span>
          </li>
        ))}
    </ul>
  ),
};

export const SandboxProviders: Story = {
  tags: ["!dev"],
  render: () => (
    <ul style={markListStyle}>
      {SANDBOX_PROVIDER_KINDS.map((kind) => (
        <li key={kind} style={markItemStyle}>
          <SandboxProviderIcon backendType={kind} height={24} />
          <span>{kind}</span>
        </li>
      ))}
    </ul>
  ),
};

export const RecordIcons: Story = {
  tags: ["!dev"],
  render: () => (
    <OptionGrid
      rows={[
        { label: "Inactive", isActive: false },
        { label: "Active", isActive: true },
      ]}
      columns={[{ label: "Icon" }, { label: "Button leading visual" }]}
      renderCell={(row, column) =>
        column?.label === "Icon" ? (
          <RecordIcon isActive={row.isActive} />
        ) : (
          <Button leadingVisual={<RecordIcon isActive={row.isActive} />}>
            {row.isActive ? "Recording" : "Record"}
          </Button>
        )
      }
    />
  ),
};

/** A sample of the set for the Overview card, not the whole catalog. */
const THUMBNAIL_ICONS: (keyof typeof Icons)[] = [
  "Person",
  "Key",
  "Grid",
  "Trace",
  "Span",
  "Funnel",
  "Book",
  "FileText",
  "Image",
  "Database",
  "Search",
  "Clock",
  "Play",
  "Pause",
  "Options",
  "Info",
  "Globe",
  "Cube",
];

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "grid",
        gridTemplateColumns: "repeat(6, auto)",
        gap: 4,
      }}
    >
      {THUMBNAIL_ICONS.map((name) => {
        const Svg = Icons[name];
        return (
          <li key={name}>
            <IconButton aria-label={name}>
              <Icon svg={<Svg />} />
            </IconButton>
          </li>
        );
      })}
    </ul>
  ),
};
