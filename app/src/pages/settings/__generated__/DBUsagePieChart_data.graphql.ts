/**
 * @generated SignedSource<<fd7a4f5e92b224da19ec998b6dd084d9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DBUsagePieChart_data$data = {
  readonly dbStorageCapacityBytes: number | null;
  readonly dbTableStats: ReadonlyArray<{
    readonly numBytes: number;
    readonly tableName: string;
  }>;
  readonly " $fragmentType": "DBUsagePieChart_data";
};
export type DBUsagePieChart_data$key = {
  readonly " $data"?: DBUsagePieChart_data$data;
  readonly " $fragmentSpreads": FragmentRefs<"DBUsagePieChart_data">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "DBUsagePieChart_data",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "DbTableStats",
      "kind": "LinkedField",
      "name": "dbTableStats",
      "plural": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "tableName",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "numBytes",
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "dbStorageCapacityBytes",
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "922bf6de312a4be0c38025ffbb868d6d";

export default node;
