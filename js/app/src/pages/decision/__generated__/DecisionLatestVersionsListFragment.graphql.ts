/**
 * @generated SignedSource<<20c84d280126c066becc8331364d4108>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DecisionLatestVersionsListFragment$data = {
  readonly latestVersions: {
    readonly edges: ReadonlyArray<{
      readonly version: {
        readonly id: string;
        readonly sequenceNumber: number;
        readonly " $fragmentSpreads": FragmentRefs<"DecisionVersionSummaryFragment">;
      };
    }>;
  };
  readonly " $fragmentType": "DecisionLatestVersionsListFragment";
};
export type DecisionLatestVersionsListFragment$key = {
  readonly " $data"?: DecisionLatestVersionsListFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"DecisionLatestVersionsListFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "DecisionLatestVersionsListFragment",
  "selections": [
    {
      "alias": "latestVersions",
      "args": [
        {
          "kind": "Literal",
          "name": "first",
          "value": 5
        }
      ],
      "concreteType": "DecisionVersionConnection",
      "kind": "LinkedField",
      "name": "versions",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "DecisionVersionEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": "version",
              "args": null,
              "concreteType": "DecisionVersion",
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
                  "name": "sequenceNumber",
                  "storageKey": null
                },
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "DecisionVersionSummaryFragment"
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": "versions(first:5)"
    }
  ],
  "type": "Decision",
  "abstractKey": null
};

(node as any).hash = "845431537f5d98b90fb3bb91c1f700bb";

export default node;
