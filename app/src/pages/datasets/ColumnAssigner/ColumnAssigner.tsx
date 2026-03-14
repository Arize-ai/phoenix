import { css } from "@emotion/react";
import { useCallback, useMemo } from "react";
import { Pressable } from "react-aria-components";

import {
  Button,
  Flex,
  Icon,
  IconButton,
  Icons,
  Switch,
  Text,
  TooltipTrigger,
} from "@phoenix/components";
import {
  RichTooltip,
  RichTooltipDescription,
  RichTooltipTitle,
} from "@phoenix/components/core/tooltip";

import { NON_OBJECT_CONFLICT_MARKER } from "./collapseUtils";
import { ColumnBucket } from "./ColumnBucket";
import type { ColumnBucket as ColumnBucketType } from "./constants";

const containerCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
`;

const headerCSS = css`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: start;
  gap: var(--global-dimension-size-200);
`;

const collapseToggleRowCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--global-dimension-size-100);
  // prevent layout shift when the switch is toggled
  min-height: 30px;
  user-select: none;
`;

const conflictListCSS = css`
  padding-top: var(--global-dimension-size-50);
  margin: 0;
  font-size: var(--global-font-size-s);

  li {
    margin-bottom: var(--global-dimension-size-50);
  }

  code {
    font-family: monospace;
    background: var(--global-background-color-300);
  }
`;

const assignmentBucketsCSS = css`
  display: grid;
  grid-template-columns: repeat(3, minmax(140px, 1fr));
  gap: var(--global-dimension-size-100);
`;

const tooltipListCSS = css`
  margin: 0;

  li {
  }

  code {
    font-family: monospace;
    background: var(--global-background-color-300);
    padding: 1px 4px;
    border-radius: 3px;
  }
`;

export type ColumnAssignerValue = {
  input: string[];
  output: string[];
  metadata: string[];
};

export type ColumnAssignerProps = {
  columns: string[];
  value: ColumnAssignerValue;
  onChange: (value: ColumnAssignerValue) => void;
  /** Called when Reset button is pressed - should reset all assignments */
  onClear?: () => void;
  /** Called when Auto button is pressed - should perform auto-assignment */
  onAuto?: () => void;
  /**
   * File type determines the label for the source bucket:
   * - "csv" -> "Columns"
   * - "jsonl" -> "Keys"
   */
  fileType?: "csv" | "jsonl" | null;
  /**
   * Whether there are any collapsible keys (keys with object values that can be flattened).
   * When true, shows the collapse toggle.
   */
  hasCollapsibleKeys?: boolean;
  /**
   * Whether collapsing is currently enabled.
   */
  collapseKeys?: boolean;
  /**
   * Called when the collapse toggle is changed.
   */
  onCollapseKeysChange?: (collapse: boolean) => void;
  /**
   * Map of keys that couldn't be collapsed due to assignment-local conflicts.
   * Key is the parent key, value is the list of conflicting emitted keys.
   */
  collapseConflicts?: Map<string, string[]>;
};

const ASSIGNMENT_BUCKETS: ColumnBucketType[] = ["input", "output", "metadata"];

export function ColumnAssigner({
  columns,
  value,
  onChange,
  onClear,
  onAuto,
  fileType,
  hasCollapsibleKeys = false,
  collapseKeys = false,
  onCollapseKeysChange,
  collapseConflicts,
}: ColumnAssignerProps) {
  // Source bucket contains only unassigned columns
  // When a column is assigned to input/output/metadata, it's removed from source
  const assignedColumns = useMemo(
    () => new Set([...value.input, ...value.output, ...value.metadata]),
    [value.input, value.output, value.metadata]
  );

  const assignment: Record<ColumnBucketType, string[]> = useMemo(
    () => ({
      source: columns.filter((col) => !assignedColumns.has(col)),
      input: value.input,
      output: value.output,
      metadata: value.metadata,
    }),
    [columns, assignedColumns, value.input, value.output, value.metadata]
  );

  // Get the label for the source bucket based on file type
  const getLabel = useCallback(
    (bucket: ColumnBucketType): string => {
      if (bucket === "source") {
        return fileType === "csv" ? "COLUMNS" : "KEYS";
      }
      return bucket.toUpperCase();
    },
    [fileType]
  );

  const handleDrop = useCallback(
    (toBucket: ColumnBucketType, column: string) => {
      // Dropping on source removes from all assignment buckets
      if (toBucket === "source") {
        const newValue: ColumnAssignerValue = {
          input: value.input.filter((c) => c !== column),
          output: value.output.filter((c) => c !== column),
          metadata: value.metadata.filter((c) => c !== column),
        };
        onChange(newValue);
        return;
      }

      // Check if column is already in the target bucket
      const isInTarget = value[toBucket].includes(column);

      if (isInTarget) {
        // Remove from target bucket (toggle off)
        const newValue: ColumnAssignerValue = {
          ...value,
          [toBucket]: value[toBucket].filter((c) => c !== column),
        };
        onChange(newValue);
      } else {
        // Add to target bucket, removing from all other buckets first (exclusive assignment)
        const newValue: ColumnAssignerValue = {
          input: value.input.filter((c) => c !== column),
          output: value.output.filter((c) => c !== column),
          metadata: value.metadata.filter((c) => c !== column),
        };
        newValue[toBucket] = [...newValue[toBucket], column];
        onChange(newValue);
      }
    },
    [value, onChange]
  );

  return (
    <div css={containerCSS}>
      <div css={headerCSS}>
        <Text size="S" color="text-700">
          Drag columns to assign them as input, output, or metadata
        </Text>
        <Flex gap="size-100">
          {onAuto && (
            <TooltipTrigger delay={300}>
              <Button variant="default" size="S" onPress={onAuto}>
                Auto
              </Button>
              <RichTooltip placement="bottom end">
                <RichTooltipTitle>Auto-Assignment Rules</RichTooltipTitle>
                <RichTooltipDescription>
                  <ul css={tooltipListCSS}>
                    <li>
                      <strong>Input:</strong> <code>input</code>,{" "}
                      <code>query</code>, <code>question</code>,{" "}
                      <code>prompt</code>
                    </li>
                    <li>
                      <strong>Output:</strong> <code>output</code>,{" "}
                      <code>reference</code>, <code>response</code>,{" "}
                      <code>expected</code>, <code>original</code>
                    </li>
                    <li>
                      <strong>Metadata:</strong> <code>metadata</code>
                    </li>
                    <li>
                      <strong>Split:</strong> <code>split</code>,{" "}
                      <code>splits</code>, <code>group</code>
                    </li>
                  </ul>
                </RichTooltipDescription>
              </RichTooltip>
            </TooltipTrigger>
          )}
          {onClear && (
            <Button variant="default" size="S" onPress={onClear}>
              Reset
            </Button>
          )}
        </Flex>
      </div>
      {hasCollapsibleKeys && onCollapseKeysChange && (
        <div css={collapseToggleRowCSS}>
          <TooltipTrigger delay={300}>
            <Pressable>
              <Switch
                isSelected={collapseKeys}
                onChange={onCollapseKeysChange}
                labelPlacement="end"
              >
                <Text size="S">Collapse top-level keys</Text>
              </Switch>
            </Pressable>
            <RichTooltip placement="bottom start">
              <RichTooltipTitle>Collapse Top-Level Keys</RichTooltipTitle>
              <RichTooltipDescription>
                When enabled, nested object keys are promoted to become
                top-level keys. This helps avoid paths like{" "}
                <code css={tooltipListCSS}>dataset.input.input</code> by
                flattening one level of nesting.
              </RichTooltipDescription>
            </RichTooltip>
          </TooltipTrigger>
          {collapseKeys && collapseConflicts && collapseConflicts.size > 0 && (
            <TooltipTrigger delay={100}>
              <IconButton
                size="S"
                color="warning"
                aria-label="Collapse conflicts detected"
              >
                <Icon svg={<Icons.AlertTriangleOutline />} />
              </IconButton>
              <RichTooltip placement="bottom start">
                <RichTooltipTitle>
                  Some keys could not be collapsed
                </RichTooltipTitle>
                <RichTooltipDescription>
                  <Text size="S">
                    The following keys could not be collapsed:
                  </Text>
                  <ul css={conflictListCSS}>
                    {Array.from(collapseConflicts.entries()).map(
                      ([parentKey, conflictList]) => {
                        const isTypeError =
                          conflictList[0] === NON_OBJECT_CONFLICT_MARKER;
                        return (
                          <li key={parentKey}>
                            <code>{parentKey}</code>:{" "}
                            {isTypeError ? (
                              "contains non-object values and cannot be collapsed"
                            ) : (
                              <>
                                {"conflicts with "}
                                {conflictList.map((c, i) => (
                                  <span key={c}>
                                    {i > 0 && ", "}
                                    <code>{c}</code>
                                  </span>
                                ))}
                              </>
                            )}
                          </li>
                        );
                      }
                    )}
                  </ul>
                </RichTooltipDescription>
              </RichTooltip>
            </TooltipTrigger>
          )}
        </div>
      )}
      <ColumnBucket
        bucket="source"
        label={getLabel("source")}
        columns={assignment.source}
        onDrop={(column) => handleDrop("source", column)}
      />
      <div css={assignmentBucketsCSS}>
        {ASSIGNMENT_BUCKETS.map((bucket) => (
          <ColumnBucket
            key={bucket}
            bucket={bucket}
            label={getLabel(bucket)}
            columns={assignment[bucket]}
            onDrop={(column) => handleDrop(bucket, column)}
          />
        ))}
      </div>
    </div>
  );
}
