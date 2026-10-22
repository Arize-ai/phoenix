/**
 * @generated SignedSource<<5fa495c673fb98dc6f14e3fec5b23115>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptLatestVersionsListFragment$data = {
  readonly latestVersions: {
    readonly edges: ReadonlyArray<{
      readonly version: {
        readonly id: string;
        readonly " $fragmentSpreads": FragmentRefs<"PromptVersionSummaryFragment">;
      };
    }>;
    readonly pageInfo: {
      readonly hasNextPage: boolean;
    };
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
          "concreteType": "PageInfo",
          "kind": "LinkedField",
          "name": "pageInfo",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "hasNextPage",
              "storageKey": null
            }
          ],
          "storageKey": null
        },
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
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "PromptVersionSummaryFragment"
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

(node as any).hash = "2683ea732d7e8bd5710c8a535fa0ba96";

export default node;
