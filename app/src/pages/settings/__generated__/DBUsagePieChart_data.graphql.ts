/**
 * @generated SignedSource<<8b36458171f24a8358e1729915aec329>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DBUsagePieChart_data$data = {
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
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "7b7167c8ac9f08c7d6574e9deba0c4cd";

export default node;
