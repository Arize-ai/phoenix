import { useVirtualizer } from "@tanstack/react-virtual";
import type { ReactNode, RefObject } from "react";

import type { SampleExample } from "../evaluatorResults";
import { EXAMPLE_FIELD_HEIGHT } from "./ExampleFieldCell";

/**
 * Every row is the same height: a field cell's header strip over its fixed
 * content area, which the evaluator cells stretch to match. A constant
 * estimate is therefore exact, and rows need no measuring.
 */
const HEADER_STRIP_HEIGHT = 39;

export const RESULTS_ROW_HEIGHT = EXAMPLE_FIELD_HEIGHT + HEADER_STRIP_HEIGHT;

/**
 * The rows in view, plus a few beyond it. A 20-row sample took the main thread
 * for seconds when every row mounted at once; virtualizing over the table's
 * scroll container mounts only the visible ones, the way the experiment
 * compare table does.
 */
export function EvaluatorPlaygroundResultsBody({
  rows,
  columnCount,
  scrollElementRef,
  renderRow,
}: {
  rows: SampleExample[];
  /** How many columns the spacer row spans. */
  columnCount: number;
  /** The `overflow: auto` wrap the table scrolls inside. */
  scrollElementRef: RefObject<HTMLDivElement | null>;
  renderRow: (example: SampleExample) => ReactNode;
}) {
  // The virtualizer mutates its instance, so the compiler cannot memoize here.
  "use no memo";

  // eslint-disable-next-line react/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => RESULTS_ROW_HEIGHT,
    // Field cells are static text, so a row is cheap; overscan a few so a
    // wheel scroll never reaches an unrendered row.
    overscan: 4,
  });

  const virtualRows = virtualizer.getVirtualItems();
  // The rows not rendered still need their room, or the scroll range ends at
  // the last rendered row. A spacer row holds it: a height on the tbody would
  // instead be shared out among the rendered rows, stretching them.
  const spacerHeight =
    virtualizer.getTotalSize() -
    virtualRows.reduce((total, row) => total + row.size, 0);

  return (
    <tbody>
      {virtualRows.map((virtualRow, index) => {
        const example = rows[virtualRow.index];

        return (
          <tr
            key={example.id}
            data-index={virtualRow.index}
            style={{
              height: virtualRow.size,
              // Rows above the window are not rendered, so the first rendered
              // row is shifted down to where it would have sat.
              transform: `translateY(${
                virtualRow.start - index * virtualRow.size
              }px)`,
            }}
          >
            {renderRow(example)}
          </tr>
        );
      })}
      <tr aria-hidden>
        <td
          colSpan={columnCount}
          style={{ height: spacerHeight, padding: 0 }}
        />
      </tr>
    </tbody>
  );
}
