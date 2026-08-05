import { css } from "@emotion/react";
import type { PropsWithChildren } from "react";

import { CopyToClipboardButton, Flex, Text } from "@phoenix/components";
import { JSONText } from "@phoenix/components/code/JSONText";
import { isObject } from "@phoenix/typeUtils";

import type { DatasetsTable_datasets$data } from "./__generated__/DatasetsTable_datasets.graphql";

type DatasetEdges = DatasetsTable_datasets$data["datasets"]["edges"];
type Dataset = DatasetEdges[number]["node"];

const datasetDetailsCSS = css`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  // Collapses to fewer, then to a single column as the table's scroll port
  // narrows, so the detail area never has to be scrolled sideways to be read
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
  gap: var(--global-dimension-size-200);
`;

const datasetDetailsValueCSS = css`
  margin-top: var(--global-dimension-size-50);
  // Descriptions are authored as prose and may carry their own line breaks
  white-space: pre-wrap;
`;

function DatasetDetail({
  label,
  children,
}: PropsWithChildren<{ label: string }>) {
  return (
    <li>
      <Text size="XS" color="text-700">
        {label}
      </Text>
      <div css={datasetDetailsValueCSS}>{children}</div>
    </li>
  );
}

/**
 * The secondary dataset information an expanded row in the datasets table
 * reveals: the values the row itself has to clip to stay scannable, plus the
 * dataset's id, which no column shows.
 */
export function DatasetRowDetails({ dataset }: { dataset: Dataset }) {
  const hasMetadata =
    isObject(dataset.metadata) && Object.keys(dataset.metadata).length > 0;
  return (
    <ul css={datasetDetailsCSS}>
      <DatasetDetail label="Dataset ID">
        <Flex direction="row" gap="size-50" alignItems="center">
          <Text fontFamily="mono">{dataset.id}</Text>
          <CopyToClipboardButton
            text={dataset.id}
            aria-label="Copy dataset ID"
          />
        </Flex>
      </DatasetDetail>
      <DatasetDetail label="Description">
        {dataset.description ? (
          <Text>{dataset.description}</Text>
        ) : (
          <Text color="text-500">No description</Text>
        )}
      </DatasetDetail>
      <DatasetDetail label="Metadata">
        {hasMetadata ? (
          <JSONText
            json={dataset.metadata}
            space={2}
            collapseSingleKey={false}
            disableTitle
          />
        ) : (
          <Text color="text-500">No metadata</Text>
        )}
      </DatasetDetail>
    </ul>
  );
}
