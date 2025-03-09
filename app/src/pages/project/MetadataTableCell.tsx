import React from "react";

import { MetadataLabel } from "@phoenix/pages/project/MetadataLabel";
import {
  makeMetadataTooltipFilterCondition,
  MetadataTooltip,
} from "@phoenix/pages/project/MetadataTooltip";
import { useSpanFilterCondition } from "@phoenix/pages/project/SpanFilterConditionContext";

type MetadataTableCellProps = {
  metadata: unknown;
};

export const MetadataTableCell = ({ metadata }: MetadataTableCellProps) => {
  const { appendFilterCondition } = useSpanFilterCondition();

  // Try to parse the metadata and stringify it
  // This is intended to work with object metadata but will technically work for arrays as well
  const [parsedMetadata, stringifiedMetadata] = React.useMemo(() => {
    try {
      const parsed: Record<string, string | number | boolean> =
        typeof metadata === "string" ? JSON.parse(metadata) : metadata;
      const stringified =
        typeof metadata === "string" ? metadata : JSON.stringify(metadata);

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
    // TODO(#6588): set this to 100% when cells are resizable and treat cell width as max width
    <div style={{ maxWidth: "300px" }}>
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
