import type { Meta, StoryFn } from "@storybook/react";
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
import { SearchIcon } from "@phoenix/components/core/field";

const meta: Meta = {
  title: "Core/Content/Icons",
  component: Icon,
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

const Template: StoryFn = () => <IconsGallery />;

export const Default = {
  render: Template,
  args: {},
};
