import { useCallback, useEffect, useState } from "react";

import type { ColumnBucket } from "./constants";
import { getAutoAssignment } from "./constants";

export type ColumnAssignment = Record<ColumnBucket, string[]>;

function createInitialAssignment(columns: string[]): ColumnAssignment {
  const assignment: ColumnAssignment = {
    source: columns, // Source always contains all columns
    input: [],
    output: [],
    metadata: [],
  };
  for (const column of columns) {
    const bucket = getAutoAssignment(column);
    if (bucket !== "source") {
      assignment[bucket].push(column);
    }
  }
  return assignment;
}

export function useColumnAssignment(columns: string[]) {
  const [assignment, setAssignment] = useState<ColumnAssignment>(() =>
    createInitialAssignment(columns)
  );

  // Re-run auto-assignment when columns change
  useEffect(() => {
    setAssignment(createInitialAssignment(columns));
  }, [columns]);

  const moveColumn = useCallback((column: string, toBucket: ColumnBucket) => {
    setAssignment((prev) => {
      // Source bucket always keeps all columns, can't modify it
      if (toBucket === "source") {
        return prev;
      }

      // Check if column is already in the target bucket
      const isInTarget = prev[toBucket].includes(column);

      if (isInTarget) {
        // Remove from target bucket (toggle off)
        return {
          ...prev,
          [toBucket]: prev[toBucket].filter((c) => c !== column),
        };
      } else {
        // Add to target bucket (columns can be in multiple buckets)
        return {
          ...prev,
          [toBucket]: [...prev[toBucket], column],
        };
      }
    });
  }, []);

  const reset = useCallback(() => {
    setAssignment(createInitialAssignment(columns));
  }, [columns]);

  return { assignment, moveColumn, reset };
}
