import type { Meta, StoryFn } from "@storybook/react";
import { useState } from "react";

import {
  Button,
  CommandPalette,
  CommandPaletteItem,
  CommandPaletteSection,
  Icon,
  Icons,
  KeyboardToken,
  MatchText,
  Text,
  useFilter,
} from "@phoenix/components";

export default {
  title: "Core/Collections/Command Palette",
  component: CommandPalette,
  parameters: {
    layout: "centered",
  },
} as Meta<typeof CommandPalette>;

/**
 * Static commands filtered client-side via useFilter's contains matcher.
 */
const Template: StoryFn<typeof CommandPalette> = () => {
  const [isOpen, setOpen] = useState(false);
  const { contains } = useFilter({ sensitivity: "base" });
  return (
    <>
      <Button onPress={() => setOpen(true)}>
        Open Command Palette&nbsp;<KeyboardToken>⌘K</KeyboardToken>
      </Button>
      <CommandPalette
        isOpen={isOpen}
        onOpenChange={setOpen}
        placeholder="Type a command…"
        filter={(textValue, inputValue) => contains(textValue, inputValue)}
        onAction={() => setOpen(false)}
      >
        <CommandPaletteSection title="Navigation">
          <CommandPaletteItem
            textValue="Go to projects"
            icon={<Icon svg={<Icons.Grid />} />}
            description="View all tracing projects"
          >
            Go to projects
          </CommandPaletteItem>
          <CommandPaletteItem
            textValue="Go to datasets"
            icon={<Icon svg={<Icons.Database />} />}
            description="Datasets and experiments"
          >
            Go to datasets
          </CommandPaletteItem>
          <CommandPaletteItem
            textValue="Go to prompts"
            icon={<Icon svg={<Icons.MessageSquare />} />}
            description="Prompt management"
          >
            Go to prompts
          </CommandPaletteItem>
        </CommandPaletteSection>
        <CommandPaletteSection title="Actions">
          <CommandPaletteItem
            textValue="Create a new project"
            icon={<Icon svg={<Icons.PlusCircle />} />}
          >
            Create a new project
          </CommandPaletteItem>
          <CommandPaletteItem
            textValue="Open the playground"
            icon={<Icon svg={<Icons.PlayCircle />} />}
            description="Prompt playground"
          >
            Open the playground
          </CommandPaletteItem>
        </CommandPaletteSection>
      </CommandPalette>
    </>
  );
};

export const Default = {
  render: Template,
};

/**
 * Server-side style search: the consumer owns the input value, pre-filters
 * the items itself (no filter prop), and highlights the matching substring.
 */
const SearchTemplate: StoryFn<typeof CommandPalette> = () => {
  const [isOpen, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { contains } = useFilter({ sensitivity: "base" });
  const datasets = [
    { name: "eval datasets", description: "Golden questions for evals" },
    { name: "Evaluator: ambiguity", description: "Reference examples" },
    { name: "chatbot transcripts", description: "Production conversations" },
  ];
  const matches = datasets.filter(
    (dataset) =>
      contains(dataset.name, search) || contains(dataset.description, search)
  );
  return (
    <>
      <Button onPress={() => setOpen(true)}>Search datasets</Button>
      <CommandPalette
        isOpen={isOpen}
        onOpenChange={setOpen}
        inputValue={search}
        onInputChange={setSearch}
        placeholder="Search datasets…"
        onAction={() => setOpen(false)}
        renderEmptyState={() => (
          <Text color="text-500">No results for “{search}”</Text>
        )}
      >
        <CommandPaletteSection title="Datasets">
          {matches.map((dataset) => (
            <CommandPaletteItem
              key={dataset.name}
              textValue={dataset.name}
              icon={<Icon svg={<Icons.Database />} />}
              description={
                <MatchText text={dataset.description} match={search} />
              }
            >
              <MatchText text={dataset.name} match={search} />
            </CommandPaletteItem>
          ))}
        </CommandPaletteSection>
      </CommandPalette>
    </>
  );
};

export const WithMatchHighlighting = {
  render: SearchTemplate,
};
