import { Fragment } from "react";

import { Text } from "@phoenix/components";
import { CopyToClipboardButton } from "@phoenix/components/core/copy";
import { CellWithControlsWrap } from "@phoenix/components/table/CellWithControlsWrap";

/**
 * Splits after each `.` and `[`, keeping the delimiter with the segment it
 * closes, so a break falls where the reader is already parsing the path.
 */
const PATH_DELIMITER = /(?<=[.[])/;

/**
 * A flattened key with a break opportunity after each of its delimiters, so a
 * key too long for the column wraps at a path boundary —
 * `llm.invocation_parameters.` / `temperature` rather than
 * `llm.invocation_parameters.temperat` / `ure`.
 */
function PathText({ path }: { path: string }) {
  const segments = path.split(PATH_DELIMITER);
  return (
    <>
      {segments.map((segment, index) => (
        // the segments of a given path never reorder, so the index is stable
        <Fragment key={index}>
          {segment}
          {index < segments.length - 1 ? <wbr /> : null}
        </Fragment>
      ))}
    </>
  );
}

/**
 * The shared frame of a JSON table cell: the text, with a copy control in the
 * top right corner revealed on hover or focus.
 *
 * Whether that text wraps or clips to one line belongs to the table as a whole
 * rather than to any one cell, so it is left to `jsonTableCSS`, which
 * selects on `className` and the table's current row state. A cell renders the
 * same either way.
 */
function JSONTableCell({
  className,
  children,
  copyText,
  copyLabel,
}: {
  /** Names the kind of text held, for the table's row rules to select on */
  className: "json-table__key" | "json-table__value";
  children: React.ReactNode;
  /** The text the control puts on the clipboard */
  copyText: string;
  /**
   * Names the copy control. A row carries one control per column, so "Copy"
   * alone would leave both the tooltip and the accessible name ambiguous.
   */
  copyLabel: string;
}) {
  return (
    <CellWithControlsWrap
      align="top"
      controls={
        <CopyToClipboardButton
          text={copyText}
          aria-label={copyLabel}
          tooltipText={copyLabel}
        />
      }
    >
      {/* No `title`: a native tooltip on every cell fires on the way to
          anywhere else in the table and covers the rows underneath. Expanding
          the rows is how the full text is read; the copy control is how it
          leaves. */}
      <div className={className}>{children}</div>
    </CellWithControlsWrap>
  );
}

/**
 * A key cell. Keys share long prefixes — `…message.role` and
 * `…message.content` differ only at the tail — so while the rows are expanded
 * a key wraps at its path boundaries rather than mid-segment, and the column
 * can be dragged wider or narrower.
 */
export function JSONTableKeyCell({ path }: { path: string }) {
  return (
    <JSONTableCell
      className="json-table__key"
      copyText={path}
      copyLabel="Copy key"
    >
      {/* mono, so that the shared prefixes of neighbouring keys line up
          character for character and the eye can skip to where they differ */}
      <Text fontFamily="mono">
        <PathText path={path} />
      </Text>
    </JSONTableCell>
  );
}

/**
 * A value cell. A value can be a whole serialized conversation; while the rows
 * are expanded it is shown in full, wrapped over as many lines as it takes, and
 * collapsing the rows is what trades that for a scannable table.
 */
export function JSONTableValueCell({ value }: { value: string }) {
  return (
    <JSONTableCell
      className="json-table__value"
      copyText={value}
      copyLabel="Copy value"
    >
      <Text>{value}</Text>
    </JSONTableCell>
  );
}
