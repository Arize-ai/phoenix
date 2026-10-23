import { css } from "@emotion/react";
import type { Meta, StoryFn } from "@storybook/react";

import { TableSkeleton } from "@phoenix/components/table";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * The loading state of a table: its header and a column of rows, standing
 * where the loaded table's header and rows will be. Where the table's toolbar
 * does not depend on the rows, it stays live above the skeleton. Set
 * `hasToolbar` when the toolbar loads with the table, as in the project's
 * spans, traces and sessions tables, so the skeleton leads with a bar where
 * the toolbar will be.
 *
 * The header is one bar and each row is five cells, whatever the loaded
 * table's columns, because the skeleton marks where rows will be rather than
 * what their cells will hold. The outer four cells keep a fixed width and the
 * middle one takes the rest; below the large breakpoint (`lg`, measured on
 * the skeleton's own width) the outermost cell on each side drops out. Set `isSelectable` when the loaded table has a
 * row-selection checkbox column, so each row leads with a checkbox
 * placeholder. Set `rowCount="fill"` when the loaded table fills its
 * container: the skeleton then takes the container's height and draws as many
 * rows as fit, without scrolling, and fades them toward the bottom while the
 * toolbar and header stay solid, since the loaded table runs on past it.
 * Pass `fadeEdge={null}` to turn the fade off.
 */
const meta: Meta = {
  title: "Design System/Tables/Table Skeleton",
  component: TableSkeleton,
  tags: ["updated", "unreviewed", "complete"],
  parameters: {
    layout: "padded",
    controls: { disable: true },
  },
};

export default meta;

const SELECTION: { label: string; isSelectable: boolean }[] = [
  { label: "No selection column", isSelectable: false },
  { label: "Selection column", isSelectable: true },
];

const TOOLBAR: { label: string; hasToolbar: boolean }[] = [
  { label: "No toolbar", hasToolbar: false },
  { label: "Toolbar", hasToolbar: true },
];

const frameCSS = css`
  width: 100%;
`;

export const Default: StoryFn = () => (
  <div css={frameCSS}>
    <TableSkeleton isSelectable />
  </div>
);
Default.tags = ["!dev"];
Default.parameters = { themeLayout: "column" };

export const SelectionColumn: StoryFn = () => (
  <OptionGrid
    columns={SELECTION}
    cellWidth="360px"
    justifyCells="stretch"
    renderCell={(_row, column) => (
      <div css={frameCSS}>
        <TableSkeleton isSelectable={column?.isSelectable} rowCount={3} />
      </div>
    )}
  />
);
SelectionColumn.storyName = "Selection Column";
SelectionColumn.tags = ["!dev"];
SelectionColumn.parameters = { themeLayout: "column" };

export const Toolbar: StoryFn = () => (
  <OptionGrid
    columns={TOOLBAR}
    cellWidth="360px"
    justifyCells="stretch"
    renderCell={(_row, column) => (
      <div css={frameCSS}>
        <TableSkeleton
          hasToolbar={column?.hasToolbar}
          isSelectable
          rowCount={3}
        />
      </div>
    )}
  />
);
Toolbar.tags = ["!dev"];
Toolbar.parameters = { themeLayout: "column" };

export const ContainerWidth: StoryFn = () => (
  <div css={frameCSS}>
    <TableSkeleton isSelectable rowCount={5} />
  </div>
);
ContainerWidth.storyName = "Container Width";
ContainerWidth.tags = ["!dev"];
ContainerWidth.parameters = { layout: "fullscreen", themeLayout: "column" };

const FILL_HEIGHTS: { label: string; code: true; height: number }[] = [
  { label: "160px", code: true, height: 160 },
  { label: "300px", code: true, height: 300 },
];

export const FillHeight: StoryFn = () => (
  <OptionGrid
    rows={FILL_HEIGHTS}
    cellWidth="480px"
    justifyCells="stretch"
    renderCell={(row) => (
      <div
        css={css`
          height: ${row.height}px;
        `}
      >
        <TableSkeleton isSelectable rowCount="fill" />
      </div>
    )}
  />
);
FillHeight.storyName = "Fill Height";
FillHeight.tags = ["!dev"];
FillHeight.parameters = { themeLayout: "column" };

const FADE_EDGES: { label: string; code: true; fadeEdge: "bottom" | null }[] = [
  { label: "null", code: true, fadeEdge: null },
  { label: "bottom", code: true, fadeEdge: "bottom" },
];

export const FadeEdge: StoryFn = () => (
  <OptionGrid
    columns={FADE_EDGES}
    cellWidth="480px"
    justifyCells="stretch"
    renderCell={(_row, column) => (
      <div
        css={css`
          height: 240px;
        `}
      >
        <TableSkeleton
          isSelectable
          rowCount="fill"
          fadeEdge={column?.fadeEdge}
        />
      </div>
    )}
  />
);
FadeEdge.storyName = "Fade Edge";
FadeEdge.tags = ["!dev"];
FadeEdge.parameters = { themeLayout: "column" };

export const Thumbnail: StoryFn = () => (
  <div
    css={css`
      ${frameCSS};
      width: 320px;
    `}
  >
    <TableSkeleton rowCount={4} isSelectable />
  </div>
);
Thumbnail.tags = ["!dev", "!autodocs"];
