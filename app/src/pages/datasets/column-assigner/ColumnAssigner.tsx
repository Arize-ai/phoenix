import { css } from "@emotion/react";
import { useCallback, useMemo } from "react";

import { Button, Flex, Text, TooltipTrigger } from "@phoenix/components";
import {
  RichTooltip,
  RichTooltipDescription,
  RichTooltipTitle,
} from "@phoenix/components/core/tooltip";

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

const assignmentBucketsCSS = css`
  display: grid;
  grid-template-columns: repeat(3, minmax(140px, 1fr));
  gap: var(--global-dimension-size-100);
`;

const tooltipListCSS = css`
  margin: 0;
  padding-left: var(--global-dimension-size-200);

  li {
    margin-bottom: var(--global-dimension-size-50);
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
  /** Called when Clear button is pressed - should clear all assignments */
  onClear?: () => void;
  /** Called when Auto button is pressed - should perform auto-assignment */
  onAuto?: () => void;
  /**
   * File type determines the label for the source bucket:
   * - "csv" -> "Columns"
   * - "jsonl" -> "Keys"
   */
  fileType?: "csv" | "jsonl" | null;
};

const ASSIGNMENT_BUCKETS: ColumnBucketType[] = ["input", "output", "metadata"];

export function ColumnAssigner({
  columns,
  value,
  onChange,
  onClear,
  onAuto,
  fileType,
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
              Clear
            </Button>
          )}
        </Flex>
      </div>
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
