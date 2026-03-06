import { css } from "@emotion/react";
import { useCallback, useRef, useState } from "react";
import type { TextDropItem } from "react-aria";
import { useDrop } from "react-aria";

import { ColumnChip } from "./ColumnChip";
import type { ColumnBucket as ColumnBucketType } from "./constants";

const bucketCSS = css`
  display: flex;
  flex-direction: column;
  height: 180px;
  padding: var(--global-dimension-size-100);
  border: 1px solid var(--global-color-gray-400);
  border-radius: var(--global-rounding-medium);
  background-color: var(--global-background-color-100);
  overflow: hidden;

  &[data-drop-target="true"] {
    border-color: var(--global-color-primary);
    border-width: 2px;
    background-color: var(--global-background-color-200);
  }

  &[data-is-source="true"] {
    background-color: var(--global-background-color-200);
  }

  &:focus-visible {
    outline: 2px solid var(--global-color-primary);
    outline-offset: -2px;
  }
`;

const titleCSS = css`
  font-size: var(--global-font-size-s);
  font-weight: 600;
  text-transform: uppercase;
  color: var(--global-text-color-700);
  margin-bottom: var(--global-dimension-size-100);
  flex-shrink: 0;
`;

const chipsContainerCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-50);
  flex: 1;
  overflow-y: auto;
  min-height: 0; /* Allow flex child to shrink below content size */
`;

export type ColumnBucketProps = {
  bucket: ColumnBucketType;
  /** Custom label to display (defaults to bucket name uppercase) */
  label?: string;
  columns: string[];
  onDrop: (column: string) => void;
  onColumnHover?: (column: string | null) => void;
};

export function ColumnBucket({
  bucket,
  label,
  columns,
  onDrop,
  onColumnHover,
}: ColumnBucketProps) {
  const ref = useRef<HTMLDivElement>(null);
  const chipsContainerRef = useRef<HTMLDivElement>(null);
  const isSource = bucket === "source";
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const { dropProps, isDropTarget } = useDrop({
    ref,
    async onDrop(e) {
      const items = e.items.filter(
        (item): item is TextDropItem =>
          item.kind === "text" && item.types.has("text/plain")
      );
      for (const item of items) {
        const columnName = await item.getText("text/plain");
        onDrop(columnName);
      }
    },
    getDropOperation(types) {
      // Only accept text/plain drops
      if (!types.has("text/plain")) {
        return "cancel";
      }
      // For source bucket: accept drops to remove from all assignments
      // Show "move" cursor to indicate removal
      if (isSource) {
        return "move";
      }
      // For other buckets: show "move" if already in bucket (will remove),
      // "copy" if not in bucket (will add)
      // Note: We can't know the exact column being dragged in getDropOperation,
      // so we always show "copy" for non-source buckets. The actual toggle
      // behavior happens in onDrop.
      return "copy";
    },
  });

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (columns.length === 0) return;

      const chips = chipsContainerRef.current?.querySelectorAll(
        "[data-chip]"
      ) as NodeListOf<HTMLElement> | undefined;
      if (!chips || chips.length === 0) return;

      let newIndex = focusedIndex;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          newIndex = focusedIndex < columns.length - 1 ? focusedIndex + 1 : 0;
          break;
        case "ArrowUp":
          e.preventDefault();
          newIndex = focusedIndex > 0 ? focusedIndex - 1 : columns.length - 1;
          break;
        case "Home":
          e.preventDefault();
          newIndex = 0;
          break;
        case "End":
          e.preventDefault();
          newIndex = columns.length - 1;
          break;
        default:
          return;
      }

      if (
        newIndex !== focusedIndex &&
        newIndex >= 0 &&
        newIndex < chips.length
      ) {
        setFocusedIndex(newIndex);
        chips[newIndex]?.focus();
      }
    },
    [columns.length, focusedIndex]
  );

  const handleFocus = useCallback(() => {
    // When bucket receives focus, focus the first chip if none is focused
    if (focusedIndex === -1 && columns.length > 0) {
      setFocusedIndex(0);
      const chips = chipsContainerRef.current?.querySelectorAll(
        "[data-chip]"
      ) as NodeListOf<HTMLElement> | undefined;
      chips?.[0]?.focus();
    }
  }, [focusedIndex, columns.length]);

  const handleChipFocus = useCallback((index: number) => {
    setFocusedIndex(index);
  }, []);

  const handleBlur = useCallback((e: React.FocusEvent) => {
    // If focus is leaving the bucket entirely, reset focused index
    if (!ref.current?.contains(e.relatedTarget as Node)) {
      setFocusedIndex(-1);
    }
  }, []);

  return (
    <div
      ref={ref}
      {...dropProps}
      role="listbox"
      aria-label={label ?? bucket.toUpperCase()}
      tabIndex={0}
      css={bucketCSS}
      data-drop-target={isDropTarget}
      data-is-source={isSource}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      <div css={titleCSS}>{label ?? bucket.toUpperCase()}</div>
      <div css={chipsContainerCSS} ref={chipsContainerRef}>
        {columns.map((column, index) => (
          <ColumnChip
            key={column}
            column={column}
            onHoverChange={onColumnHover}
            tabIndex={focusedIndex === index ? 0 : -1}
            onFocus={() => handleChipFocus(index)}
            isAssigned={!isSource}
          />
        ))}
      </div>
    </div>
  );
}
