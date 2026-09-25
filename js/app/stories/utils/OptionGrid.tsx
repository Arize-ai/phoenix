import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Fragment } from "react";

import { Text } from "@phoenix/components";

/**
 * A row or column heading. `code` marks a literal prop value (`S`, `danger`,
 * `16`), set in monospace because it is what a reader types; a description
 * ("Leading visual", "read only") is set in the default face.
 */
export type OptionGridLabel = {
  label: string;
  code?: boolean;
};

export type OptionGridProps<
  Row extends OptionGridLabel,
  Column extends OptionGridLabel,
> = {
  /** Omit for a single unlabeled row. */
  rows?: readonly Row[];
  /** Omit for a single unlabeled column. */
  columns?: readonly Column[];
  renderCell: (row: Row, column: Column | undefined) => ReactNode;
  /** A fixed width for every cell column, for fields that fill their container. */
  cellWidth?: string;
  /** Cell alignment within its column. */
  justifyCells?: "start" | "center" | "stretch";
  /**
   * Cell alignment within its row: `start` for cells of differing height,
   * such as fields with messages. Row headings are always centered.
   */
  alignRows?: "start" | "center";
};

function Heading({ label, code }: OptionGridLabel) {
  return (
    <Text size="S" color="text-700" fontFamily={code ? "mono" : "default"}>
      {label}
    </Text>
  );
}

/**
 * The option grid a story uses to show a component's whole option space: one
 * row per value of one axis, one column per value of another, and the
 * component in every cell. It owns the layout and the label styling so every
 * grid in Storybook reads the same way.
 */
export function OptionGrid<
  Row extends OptionGridLabel,
  Column extends OptionGridLabel,
>({
  rows,
  columns,
  renderCell,
  cellWidth = "auto",
  justifyCells = "start",
  alignRows = "center",
}: OptionGridProps<Row, Column>) {
  const cellColumns = columns ?? [undefined];
  const hasRowHeadings = rows !== undefined;
  const cellRows = rows ?? [{ label: "" } as Row];
  const cellTracks = `repeat(${cellColumns.length}, ${cellWidth})`;
  const templateColumns = hasRowHeadings ? `auto ${cellTracks}` : cellTracks;
  return (
    <div
      css={css`
        display: grid;
        grid-template-columns: ${templateColumns};
        gap: var(--global-dimension-size-150) var(--global-dimension-size-300);
        align-items: ${alignRows};
        justify-items: ${justifyCells};
      `}
    >
      {columns ? (
        <>
          {hasRowHeadings ? <span /> : null}
          {columns.map((column) => (
            <Heading key={column.label} {...column} />
          ))}
        </>
      ) : null}
      {cellRows.map((row) => (
        <Fragment key={row.label}>
          {hasRowHeadings ? (
            <span
              css={css`
                justify-self: start;
                align-self: center;
              `}
            >
              <Heading {...row} />
            </span>
          ) : null}
          {cellColumns.map((column) => (
            <Fragment key={column?.label ?? ""}>
              {renderCell(row, column)}
            </Fragment>
          ))}
        </Fragment>
      ))}
    </div>
  );
}
