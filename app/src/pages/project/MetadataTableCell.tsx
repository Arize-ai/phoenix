import { useMemo } from "react";

import { MetadataLabel } from "@phoenix/pages/project/MetadataLabel";
import {
  makeMetadataTooltipFilterCondition,
  MetadataTooltip,
} from "@phoenix/pages/project/MetadataTooltip";
import { useSpanFilterCondition } from "@phoenix/pages/project/SpanFilterConditionContext";
import { jsonStringToFlatObject } from "@phoenix/utils/jsonUtils";

type MetadataTableCellProps = {
  metadata: unknown;
};

export const MetadataTableCell = ({ metadata }: MetadataTableCellProps) => {
  const { appendFilterCondition } = useSpanFilterCondition();

  // Try to parse the metadata and stringify it
  // This is intended to work with object metadata but will technically work for arrays as well
  const [parsedMetadata, stringifiedMetadata] = useMemo(() => {
    try {
      if (typeof metadata !== "string") {
        throw new Error("Metadata is not a string");
      }
      const parsed = jsonStringToFlatObject(metadata);
      const stringified = JSON.stringify(parsed);

      // If metadata is empty, return empty values
      if (Object.keys(parsed).length === 0) {
        throw new Error("Metadata is empty");
      }

      return [parsed, stringified];
    } catch (e) {
      // If parsing fails, show nothing
      return [null, null];
    }
  }, [metadata]);

  if (!parsedMetadata || !stringifiedMetadata) {
    return "--";
  }

  return (
    <div style={{ maxWidth: "100%" }}>
      <MetadataTooltip width="800px" metadata={parsedMetadata}>
        <MetadataLabel
          metadata={stringifiedMetadata}
          onClick={() => {
            // Use the first key-value pair for the default filter
            const [key, value] = Object.entries(parsedMetadata)[0];
            const filterCondition = makeMetadataTooltipFilterCondition(
              key,
              value
            );
            appendFilterCondition(filterCondition);
          }}
        />
      </MetadataTooltip>
    </div>
  );
};
