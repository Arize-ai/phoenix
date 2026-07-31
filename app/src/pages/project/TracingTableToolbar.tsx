import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { DSL_FILTER_CONDITION_FIELD_COMPACT_BREAKPOINT_PX } from "@phoenix/components/filter";
import { useHasOpenDrawer } from "@phoenix/hooks/useHasOpenModal";

const COLUMN_SELECTOR_SLOT_WIDTH_PX = 128;
const COLUMN_SELECTOR_COMPACT_WIDTH_PX = 38;
const PRIMARY_ACTION_WIDTH_PX = 38;
const TOOLBAR_GAP_PX = 8;
// The grid retains the expanded slot as stable breakpoint geometry. When the
// label disappears, the field visually borrows the difference; only once that
// reclaimed field reaches 250px do both controls become compact.
const COLUMN_SELECTOR_COMPACT_BREAKPOINT_PX =
  DSL_FILTER_CONDITION_FIELD_COMPACT_BREAKPOINT_PX +
  COLUMN_SELECTOR_SLOT_WIDTH_PX +
  PRIMARY_ACTION_WIDTH_PX +
  TOOLBAR_GAP_PX * 2;
const PRIMARY_CONTROLS_COMPACT_BREAKPOINT_PX =
  DSL_FILTER_CONDITION_FIELD_COMPACT_BREAKPOINT_PX +
  COLUMN_SELECTOR_COMPACT_WIDTH_PX +
  PRIMARY_ACTION_WIDTH_PX +
  TOOLBAR_GAP_PX * 2;

const tracingTableToolbarCSS = css`
  box-sizing: border-box;
  flex: none;
  width: 100%;
  padding: var(--global-dimension-size-100)
    calc(var(--global-dimension-size-200) + var(--app-drawer-right-inset, 0px))
    var(--global-dimension-size-100) var(--global-dimension-size-200);
  border-bottom: var(--global-border-size-thin) solid
    var(--global-border-color-default);

  .tracing-table-toolbar__content {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
    min-width: 0;
    width: 100%;
  }

  .tracing-table-toolbar__primary-controls {
    position: relative;
    container-type: inline-size;
    display: grid;
    grid-template-columns:
      minmax(0, 1fr) ${COLUMN_SELECTOR_SLOT_WIDTH_PX}px
      ${PRIMARY_ACTION_WIDTH_PX}px;
    align-items: center;
    gap: var(--global-dimension-size-100);
    flex: 1 1 auto;
    min-width: 0;
  }

  .tracing-table-toolbar__field {
    min-width: 0;
    --field-min-width: 0;
  }

  .tracing-table-toolbar__column-selector,
  .tracing-table-toolbar__primary-action,
  .tracing-table-toolbar__actions {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
    flex: none;
  }

  .tracing-table-toolbar__column-selector {
    justify-content: flex-start;
  }

  &[data-has-open-drawer="true"] {
    padding-inline-end: calc(
      var(--app-drawer-right-inset, 0px) + var(--global-dimension-size-100)
    );

    .tracing-table-toolbar__field {
      width: calc(
        100% + ${COLUMN_SELECTOR_SLOT_WIDTH_PX}px -
          ${COLUMN_SELECTOR_COMPACT_WIDTH_PX}px
      );
    }

    .tracing-table-toolbar__column-selector {
      justify-content: flex-end;
    }

    .column-selector__button {
      width: var(--global-button-height-m);
      padding: 0;
    }

    .column-selector__button-label {
      display: none;
    }
  }

  &[data-collapse-column-with-field="true"] {
    @container (max-width: ${COLUMN_SELECTOR_COMPACT_BREAKPOINT_PX}px) {
      .tracing-table-toolbar__field {
        width: calc(
          100% + ${COLUMN_SELECTOR_SLOT_WIDTH_PX}px -
            ${COLUMN_SELECTOR_COMPACT_WIDTH_PX}px
        );
      }

      .tracing-table-toolbar__column-selector {
        justify-content: flex-end;
      }

      .column-selector__button {
        width: var(--global-button-height-m);
        padding: 0;
      }

      .column-selector__button-label {
        display: none;
      }
    }

    @container (max-width: ${PRIMARY_CONTROLS_COMPACT_BREAKPOINT_PX}px) {
      .tracing-table-toolbar__field {
        width: 100%;
      }

      .tracing-table-toolbar__column-selector {
        position: absolute;
        inset-block-start: 0;
        inset-inline-start: calc(
          var(--global-button-height-m) + var(--global-dimension-size-100)
        );
        justify-content: flex-start;
      }

      .tracing-table-toolbar__primary-action {
        position: absolute;
        inset-block-start: 0;
        inset-inline-start: calc(
          var(--global-button-height-m) * 2 + var(--global-dimension-size-100) *
            2
        );
      }

      .column-selector__button {
        width: var(--global-button-height-m);
        padding: 0;
      }

      .column-selector__button-label {
        display: none;
      }
    }
  }
`;

export type TracingTableToolbarProps = {
  field: ReactNode;
  columnSelector: ReactNode;
  primaryAction: ReactNode;
  actions?: ReactNode;
  /** Collapse and left-group Columns at the field's compact breakpoint. */
  collapseColumnWithField?: boolean;
};

/**
 * The responsive toolbar shared by the spans, traces, and sessions tables.
 * Its right inset mirrors the top navigation so a fixed details drawer takes
 * space from the toolbar instead of covering it. While a drawer is present,
 * only the primary field, column selector, and primary row action remain.
 */
export function TracingTableToolbar({
  field,
  columnSelector,
  primaryAction,
  actions,
  collapseColumnWithField = false,
}: TracingTableToolbarProps) {
  const hasOpenDrawer = useHasOpenDrawer();

  return (
    <div
      css={tracingTableToolbarCSS}
      className="tracing-table-toolbar"
      data-has-open-drawer={hasOpenDrawer}
      data-collapse-column-with-field={collapseColumnWithField}
    >
      <div className="tracing-table-toolbar__content">
        <div className="tracing-table-toolbar__primary-controls">
          <div className="tracing-table-toolbar__field">{field}</div>
          <div className="tracing-table-toolbar__column-selector">
            {columnSelector}
          </div>
          <div className="tracing-table-toolbar__primary-action">
            {primaryAction}
          </div>
        </div>
        {hasOpenDrawer ? null : (
          <div className="tracing-table-toolbar__actions">{actions}</div>
        )}
      </div>
    </div>
  );
}
