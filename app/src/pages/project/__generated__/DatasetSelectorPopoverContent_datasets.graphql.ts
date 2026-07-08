/**
 * @generated SignedSource<<048d0a9018a8ef149b190ddfa81c018f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DatasetSelectorPopoverContent_datasets$data = {
  readonly datasets: {
    readonly edges: ReadonlyArray<{
      readonly dataset: {
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
  readonly " $fragmentType": "DatasetSelectorPopoverContent_datasets";
};
export type DatasetSelectorPopoverContent_datasets$key = {
  readonly " $data"?: DatasetSelectorPopoverContent_datasets$data;
  readonly " $fragmentSpreads": FragmentRefs<"DatasetSelectorPopoverContent_datasets">;
};

import DatasetSelectorPopoverContentDatasetsQuery_graphql from './DatasetSelectorPopoverContentDatasetsQuery.graphql';

const node: ReaderFragment = {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "search"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [],
      "operation": DatasetSelectorPopoverContentDatasetsQuery_graphql
    }
  },
  "name": "DatasetSelectorPopoverContent_datasets",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "fields": [
            {
              "kind": "Literal",
              "name": "col",
              "value": "name"
            },
            {
              "kind": "Variable",
              "name": "value",
              "variableName": "search"
            }
          ],
          "kind": "ObjectValue",
          "name": "filter"
        }
      ],
      "concreteType": "DatasetConnection",
      "kind": "LinkedField",
      "name": "datasets",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "DatasetEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": "dataset",
              "args": null,
              "concreteType": "Dataset",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "id",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "name",
                  "storageKey": null
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "60d20faa9c3d4bbb03be15dec748af49";

export default node;
