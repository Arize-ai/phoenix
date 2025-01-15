/**
 * @generated SignedSource<<31e402c4eceae4679cae3a3c0e9eb272>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptLatestVersionsListFragment$data = {
  readonly latestVersions: {
    readonly edges: ReadonlyArray<{
      readonly version: {
        readonly createdAt: string;
        readonly description: string | null;
        readonly id: string;
      };
    }>;
  };
  readonly " $fragmentType": "PromptLatestVersionsListFragment";
};
export type PromptLatestVersionsListFragment$key = {
  readonly " $data"?: PromptLatestVersionsListFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptLatestVersionsListFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptLatestVersionsListFragment",
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
      "concreteType": "PromptVersionConnection",
      "kind": "LinkedField",
      "name": "promptVersions",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "PromptVersionEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": "version",
              "args": null,
              "concreteType": "PromptVersion",
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
                  "name": "description",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "createdAt",
                  "storageKey": null
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": "promptVersions(first:5)"
    }
  ],
  "type": "Prompt",
  "abstractKey": null
};

(node as any).hash = "5442dc979627471880a0ee9b6f089a21";

export default node;
