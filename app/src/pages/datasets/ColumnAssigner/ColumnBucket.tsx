import { css } from "@emotion/react";
import { useCallback, useRef, useState } from "react";
import type { TextDropItem } from "react-aria";
import { useDrop } from "react-aria";

import { ColumnTag } from "./ColumnTag";
import type { ColumnBucket as ColumnBucketType } from "./constants";

const bucketBaseCSS = css`
  display: flex;
  flex-direction: column;
  padding: var(--global-dimension-size-100);
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  background-color: var(--global-background-color-100);

  &[data-drop-target="true"] {
    border-color: var(--global-color-primary);
    background-color: var(--global-background-color-200);
  }

  &:focus-visible {
    outline: 1px solid var(--global-color-primary);
    outline-offset: -2px;
  }
`;

const assignmentBucketCSS = css`
  height: 180px;
`;

const sourceBucketCSS = css`
  background-color: var(--global-background-color-200);
`;

const titleCSS = css`
  font-size: var(--global-font-size-s);
  font-weight: 600;
  text-transform: uppercase;
  color: var(--global-text-color-700);
  margin-bottom: var(--global-dimension-size-100);
  flex-shrink: 0;
`;

const tagsContainerCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-50);
  flex: 1;
  overflow-y: auto;
  min-height: 0;
`;

const sourceTagsContainerCSS = css`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: var(--global-dimension-size-50);
`;

const emptyStateCSS = css`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: var(--global-dimension-size-200);
  color: var(--global-text-color-500);
  font-size: var(--global-font-size-s);
  font-style: italic;
  text-align: center;
`;

export type ColumnBucketProps = {
  bucket: ColumnBucketType;
  /** Custom label to display (defaults to bucket name uppercase) */
  label?: string;
  columns: string[];
  onDrop: (column: string) => void;
};

export function ColumnBucket({
  bucket,
  label,
  columns,
  onDrop,
}: ColumnBucketProps) {
  const ref = useRef<HTMLDivElement>(null);
  const tagsContainerRef = useRef<HTMLDivElement>(null);
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

      const tags = tagsContainerRef.current?.querySelectorAll("[data-tag]") as
        | NodeListOf<HTMLElement>
        | undefined;
      if (!tags || tags.length === 0) return;

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
        newIndex < tags.length
      ) {
        setFocusedIndex(newIndex);
        tags[newIndex]?.focus();
      }
    },
    [columns.length, focusedIndex]
  );

  const handleFocus = useCallback(() => {
    // When bucket receives focus, focus the first tag if none is focused
    if (focusedIndex === -1 && columns.length > 0) {
      setFocusedIndex(0);
      const tags = tagsContainerRef.current?.querySelectorAll("[data-tag]") as
        | NodeListOf<HTMLElement>
        | undefined;
      tags?.[0]?.focus();
    }
  }, [focusedIndex, columns.length]);

  const handleTagFocus = useCallback((index: number) => {
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
      css={[bucketBaseCSS, isSource ? sourceBucketCSS : assignmentBucketCSS]}
      data-drop-target={isDropTarget}
      data-is-source={isSource}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      <div css={titleCSS}>{label ?? bucket.toUpperCase()}</div>
      <div
        css={isSource ? sourceTagsContainerCSS : tagsContainerCSS}
        ref={tagsContainerRef}
      >
        {columns.length === 0 && !isSource ? (
          <div css={emptyStateCSS}>Drag columns here</div>
        ) : (
          columns.map((column, index) => (
            <ColumnTag
              key={column}
              column={column}
              tabIndex={focusedIndex === index ? 0 : -1}
              onFocus={() => handleTagFocus(index)}
              isAssigned={!isSource}
            />
          ))
        )}
      </div>
    </div>
  );
}
