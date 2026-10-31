import { css } from "@emotion/react";
import type { Meta, StoryFn } from "@storybook/react";
import type { ReactNode } from "react";

import {
  Button,
  FloatingToolbarContainer,
  Group,
  Icon,
  IconButton,
  Icons,
  Separator,
  Text,
  Toolbar,
} from "@phoenix/components";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A row or column of controls that the arrow keys move between, so the whole
 * set is one tab stop. Every Phoenix toolbar acts on a table selection and
 * floats over the table in a `FloatingToolbarContainer`.
 *
 * A `Separator` divides groups of controls; give it the orientation opposite
 * the toolbar's, since it does not read the toolbar's own.
 */
const meta: Meta = {
  title: "Design System/Actions/Toolbar",
  tags: ["updated", "unreviewed", "complete"],
  component: Toolbar,
  subcomponents: { FloatingToolbarContainer, Separator },
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

function SelectionToolbar() {
  return (
    <FloatingToolbarContainer>
      <Toolbar aria-label="Example selection">
        <IconButton size="M" aria-label="Clear selection">
          <Icon svg={<Icons.Close />} />
        </IconButton>
        <Text>3 examples selected</Text>
        <Button
          variant="danger"
          size="M"
          leadingVisual={<Icon svg={<Icons.Trash />} />}
        >
          Delete
        </Button>
      </Toolbar>
    </FloatingToolbarContainer>
  );
}

function TableFrame({ children }: { children: ReactNode }) {
  return (
    <div
      css={css`
        position: relative;
        width: 400px;
        height: 120px;
      `}
    >
      {children}
    </div>
  );
}

export const Default: StoryFn = () => (
  <TableFrame>
    <SelectionToolbar />
  </TableFrame>
);
Default.tags = ["!dev"];

const ORIENTATIONS = [
  { label: "horizontal", code: true },
  { label: "vertical", code: true },
] as const;

export const Orientations: StoryFn = () => (
  <OptionGrid
    rows={ORIENTATIONS}
    renderCell={({ label: orientation }) => (
      <Toolbar
        aria-label="Annotation config selection"
        orientation={orientation}
      >
        <IconButton size="M" aria-label="Clear selection">
          <Icon svg={<Icons.Close />} />
        </IconButton>
        <Separator
          orientation={orientation === "horizontal" ? "vertical" : "horizontal"}
        />
        <Group aria-label="Selected configs">
          <Button size="M" leadingVisual={<Icon svg={<Icons.Edit />} />}>
            Edit
          </Button>
          <Button
            variant="danger"
            size="M"
            leadingVisual={<Icon svg={<Icons.Trash />} />}
          >
            Delete
          </Button>
        </Group>
      </Toolbar>
    )}
  />
);
Orientations.tags = ["!dev"];

export const Thumbnail: StoryFn = () => (
  <TableFrame>
    <SelectionToolbar />
  </TableFrame>
);
Thumbnail.tags = ["!dev", "!autodocs"];
Thumbnail.parameters = { thumbnail: { scale: 0.7 } };
