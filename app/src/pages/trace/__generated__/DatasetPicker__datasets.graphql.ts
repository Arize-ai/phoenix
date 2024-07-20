/**
 * @generated SignedSource<<9e0d7c9423dde9c56968467a61a5e255>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment, RefetchableFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DatasetPicker__datasets$data = {
  readonly datasets: {
    readonly edges: ReadonlyArray<{
      readonly dataset: {
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
  readonly " $fragmentType": "DatasetPicker__datasets";
};
export type DatasetPicker__datasets$key = {
  readonly " $data"?: DatasetPicker__datasets$data;
  readonly " $fragmentSpreads": FragmentRefs<"DatasetPicker__datasets">;
};

import DatasetPickerRefetchQuery_graphql from './DatasetPickerRefetchQuery.graphql';

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [],
      "operation": DatasetPickerRefetchQuery_graphql
    }
  },
  "name": "DatasetPicker__datasets",
  "selections": [
    {
      "alias": null,
      "args": null,
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

(node as any).hash = "03d88d1706089bb63edcd44d04563cbc";

export default node;
